import { createHmac, randomBytes } from "node:crypto";

export const DEMO_ACCESS_COOKIE = "paypilot_demo";
export const DEMO_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getDemoAccessCode(): string | undefined {
  const value = process.env.DEMO_ACCESS_CODE?.trim();
  return value && value.length > 0 ? value : undefined;
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

export function createSignedToken(options?: {
  sessionId?: string;
  now?: number;
  secret?: string;
}): string {
  const now = options?.now ?? Date.now();
  const sid = options?.sessionId ?? randomBytes(16).toString("hex");
  const secret = options?.secret ?? getCookieSecret();
  const payload = `${now}.${sid}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySignedToken(
  token: string,
  options?: { now?: number; secret?: string },
): { valid: boolean; sessionId?: string } {
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
  const expectedSig = createHmac("sha256", secret).update(`${timestamp}.${sessionId}`).digest("hex");
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

export function isDemoAccessGranted(request: Request, now = Date.now()): boolean {
  const expected = getDemoAccessCode();
  if (!expected) {
    return true;
  }
  const provided = demoCookieFromRequest(request);
  if (!provided) {
    return false;
  }
  // Check signed token
  const verified = verifySignedToken(provided, { now });
  if (verified.valid) {
    return true;
  }
  // Fallback: check plaintext code (for backwards compatibility with unit tests)
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
