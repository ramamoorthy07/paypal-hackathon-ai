import { NextResponse } from "next/server";
import { clientIp, denyIfAbusive } from "@/lib/access/abuse";
import {
  DEMO_ACCESS_COOKIE,
  createSignedToken,
  demoCookieOptions,
  getDemoAccessCode,
  timingSafeEqualString,
} from "@/lib/access/demo-code";

export const dynamic = "force-dynamic";

// In-memory tracker for failed unlock attempts (max 5 failed per 15 minutes per IP)
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function checkUnlockRateLimit(ip: string, now = Date.now()): boolean {
  const record = failedAttempts.get(ip);
  if (!record || now > record.resetAt) {
    return true; // Not rate limited
  }
  return record.count < 5;
}

function recordUnlockFailure(ip: string, now = Date.now()): void {
  const record = failedAttempts.get(ip);
  if (!record || now > record.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    record.count += 1;
  }
}

function resetUnlockFailures(ip: string): void {
  failedAttempts.delete(ip);
}

export async function POST(request: Request): Promise<NextResponse> {
  const denied = await denyIfAbusive(request, { requireAccess: false });
  if (denied) {
    return denied;
  }

  const ip = clientIp(request);
  const unlockUrl = new URL("/unlock", request.url);

  if (!checkUnlockRateLimit(ip)) {
    unlockUrl.searchParams.set("error", "rate_limit");
    return NextResponse.redirect(unlockUrl, 303);
  }

  const expected = getDemoAccessCode();
  const form = await request.formData().catch(() => null);
  const submitted = typeof form?.get("code") === "string" ? String(form.get("code")).trim() : "";
  const from = typeof form?.get("from") === "string" ? String(form.get("from")).trim() : "";

  if (from && from.startsWith("/") && !from.startsWith("//")) {
    unlockUrl.searchParams.set("from", from);
  }

  if (!expected) {
    unlockUrl.searchParams.set("error", "unset");
    return NextResponse.redirect(unlockUrl, 303);
  }

  if (!timingSafeEqualString(submitted, expected)) {
    recordUnlockFailure(ip);
    unlockUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(unlockUrl, 303);
  }

  resetUnlockFailures(ip);

  // Determine redirect destination (from target or root)
  const targetPath = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
  const response = NextResponse.redirect(new URL(targetPath, request.url), 303);

  // Generate cryptographic signed token (Web Crypto — Edge-safe)
  const signedToken = await createSignedToken();
  response.cookies.set(DEMO_ACCESS_COOKIE, signedToken, demoCookieOptions());
  return response;
}

