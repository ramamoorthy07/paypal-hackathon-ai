export const DEMO_ACCESS_COOKIE = "paypilot_demo";

export function getDemoAccessCode(): string | undefined {
  const value = process.env.DEMO_ACCESS_CODE?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function isDemoProtectedPath(pathname: string): boolean {
  if (pathname === "/api/chat" || pathname.startsWith("/api/chat/")) {
    return true;
  }
  if (pathname === "/api/invoices/confirm") {
    return true;
  }
  return /^\/api\/invoices\/[^/]+\/remind$/.test(pathname);
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

export function isDemoAccessGranted(request: Request): boolean {
  const expected = getDemoAccessCode();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const provided = demoCookieFromRequest(request);
  if (!provided) {
    return false;
  }
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
