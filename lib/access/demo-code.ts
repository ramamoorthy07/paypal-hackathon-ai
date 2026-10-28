export const DEMO_ACCESS_COOKIE = "paypilot_demo";
export const DEMO_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getDemoAccessCode(): string | undefined {
  const value = process.env.DEMO_ACCESS_CODE?.trim();
  return value && value.length > 0 ? value : undefined;
}

function firstHeaderValue(header: string | null): string | undefined {
  const value = header?.split(",")[0]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function isLoopbackOrWildcardHost(host: string): boolean {
  const hostname = host.replace(/^\[|\]$/g, "").split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "localhost"
  );
}

/**
 * Public site origin for redirects behind reverse proxies (Render, etc.).
 * `request.url` can be the container bind address (`https://0.0.0.0:10000`).
 */
export function publicRequestOrigin(request: Request): string {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const hostHeader = firstHeaderValue(request.headers.get("host"));
  const host = forwardedHost || hostHeader;
  const url = new URL(request.url);
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));

  if (host && !isLoopbackOrWildcardHost(host)) {
    const proto = forwardedProto || (url.protocol === "https:" ? "https" : "http");
    return `${proto}://${host}`;
  }

  for (const key of ["APP_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore invalid */
    }
  }

  return url.origin;
}

export function publicRequestUrl(path: string, request: Request): URL {
  return new URL(path, publicRequestOrigin(request));
}

export function getCookieSecret(): string {
  const secret = process.env.DEMO_COOKIE_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (secret && secret.length > 0) {
    return secret;
  }
  const accessCode = getDemoAccessCode();
  if (accessCode) {
    return `paypilot-hmac-${accessCode}`;
  }
  return "paypilot-insecure-dev-salt";
}

/**
 * Checks whether a path is exempt from the demo access gate.
 * Exempt routes:
 * - /unlock, /api/unlock
 * - /api/health, /api/health/live
 * - /api/webhooks/paypal (signature-verified by PayPal)
 * - /api/cron/* (authenticated via CRON_SECRET)
 * - /api/mcp (authenticated via MCP bearer token)
 */
export function isExemptPath(pathname: string): boolean {
  if (pathname === "/unlock" || pathname === "/api/unlock") {
    return true;
  }
  if (pathname === "/api/health" || pathname === "/api/health/live") {
    return true;
  }
  if (pathname === "/api/webhooks/paypal") {
    return true;
  }
  if (pathname.startsWith("/api/cron/") || pathname === "/api/cron") {
    return true;
  }
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) {
    return true;
  }
  return false;
}

export function isDemoProtectedPath(pathname: string): boolean {
  return !isExemptPath(pathname);
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

function randomSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** Edge-safe HMAC-SHA256 (Web Crypto) — middleware cannot use node:crypto. */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(signature);
}

export async function createSignedToken(options?: {
  sessionId?: string;
  now?: number;
  secret?: string;
}): Promise<string> {
  const now = options?.now ?? Date.now();
  const sid = options?.sessionId ?? randomSessionId();
  const secret = options?.secret ?? getCookieSecret();
  const payload = `${now}.${sid}`;
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySignedToken(
  token: string,
  options?: { now?: number; secret?: string },
): Promise<{ valid: boolean; sessionId?: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }
  const [timestampStr, sessionId, sig] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (Number.isNaN(timestamp) || !sessionId || !sig) {
    return { valid: false };
  }
  const now = options?.now ?? Date.now();
  if (now < timestamp || now - timestamp > DEMO_TOKEN_MAX_AGE_MS) {
    return { valid: false };
  }
  const secret = options?.secret ?? getCookieSecret();
  const expectedSig = await hmacSha256Hex(secret, `${timestamp}.${sessionId}`);
  if (!timingSafeEqualString(sig, expectedSig)) {
    return { valid: false };
  }
  return { valid: true, sessionId };
}

export function demoCookieFromRequest(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const name = trimmed.slice(0, eq);
    if (name !== DEMO_ACCESS_COOKIE) {
      continue;
    }
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

export async function isDemoAccessGranted(request: Request, now = Date.now()): Promise<boolean> {
  const expected = getDemoAccessCode();
  if (!expected) {
    return true;
  }
  const provided = demoCookieFromRequest(request);
  if (!provided) {
    return false;
  }
  const verified = await verifySignedToken(provided, { now });
  if (verified.valid) {
    return true;
  }
  // Fallback: plaintext code (unit tests / legacy cookies)
  return timingSafeEqualString(provided, expected);
}

export function demoCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
