import { NextResponse } from "next/server";
import { getEnv } from "@/lib/core/env";
import { demoCookieFromRequest, isDemoAccessGranted, verifySignedToken } from "@/lib/access/demo-code";
import { atomicIncrementRateLimit } from "@/lib/db/repositories/rate-limits";

export type AbuseKind = {
  requireAccess?: boolean;
  llm?: boolean;
  paypalWrite?: boolean;
};

type LimitConfig = {
  perMinute: number;
  dailyLlm: number;
  dailyPaypalWrites: number;
  sessionDailyLlm: number;
};

// In-memory fallbacks for unit tests and local dev
const rateCounts = new Map<string, number>();
const dailyCounts = new Map<string, number>();

function limitConfig(): LimitConfig {
  try {
    const env = getEnv();
    return {
      perMinute: env.RATE_LIMIT_PER_MINUTE,
      dailyLlm: env.DAILY_LLM_CALL_LIMIT,
      dailyPaypalWrites: env.DAILY_PAYPAL_WRITE_LIMIT,
      sessionDailyLlm: Math.min(env.DAILY_LLM_CALL_LIMIT, 40),
    };
  } catch {
    return { perMinute: 30, dailyLlm: 80, dailyPaypalWrites: 20, sessionDailyLlm: 40 };
  }
}

/**
 * Extracts client IP using Cloudflare/Render trusted headers.
 * Never trusts leftmost untrusted X-Forwarded-For if client could inject it.
 * Priority: cf-connecting-ip -> true-client-ip -> x-real-ip -> rightmost x-forwarded-for -> 127.0.0.1
 */
export function clientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) {
    return cfIp;
  }

  const trueClientIp = request.headers.get("true-client-ip")?.trim();
  if (trueClientIp) {
    return trueClientIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      // Rightmost entry is appended by the nearest trusted proxy
      return parts[parts.length - 1]!;
    }
  }

  return "127.0.0.1";
}

export async function sessionIdFromRequest(request: Request): Promise<string | undefined> {
  const cookie = demoCookieFromRequest(request);
  if (!cookie) return undefined;
  const verified = await verifySignedToken(cookie);
  if (verified.valid && verified.sessionId) {
    return verified.sessionId;
  }
  return undefined;
}

function inMemoryBump(map: Map<string, number>, key: string, limit: number, delta = 1): boolean {
  const next = (map.get(key) ?? 0) + delta;
  map.set(key, next);
  return next <= limit;
}

async function bumpLimit(
  key: string,
  limit: number,
  expiresAt: number,
  delta = 1,
): Promise<{ ok: boolean; count: number }> {
  // Unit tests stay on the in-memory maps so they do not need a migrated DB.
  if (process.env.VITEST) {
    const ok = inMemoryBump(rateCounts, key, limit, delta);
    return { ok, count: rateCounts.get(key) ?? 1 };
  }

  try {
    const count = await atomicIncrementRateLimit(key, expiresAt, delta);
    return { ok: count <= limit, count };
  } catch {
    // In-memory fallback when the DB is unavailable
    const ok = inMemoryBump(rateCounts, key, limit, delta);
    return { ok, count: rateCounts.get(key) ?? 1 };
  }
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function resetAbuseStateForTests(): void {
  rateCounts.clear();
  dailyCounts.clear();
}

/**
 * Counts additional LLM steps executed during agent tool recursion
 * against the daily LLM budget.
 */
export async function recordLlmSteps(
  request: Request,
  additionalSteps: number,
  now = Date.now(),
): Promise<void> {
  if (additionalSteps <= 0) return;
  const day = utcDay(now);
  const endOfDay = new Date(`${day}T23:59:59.999Z`).getTime();
  const limits = limitConfig();

  // Increment global budget
  await bumpLimit(`daily:${day}:llm`, limits.dailyLlm, endOfDay, additionalSteps);

  // Increment session budget if signed token present
  const sid = await sessionIdFromRequest(request);
  if (sid) {
    await bumpLimit(`sess:${sid}:${day}:llm`, limits.sessionDailyLlm, endOfDay, additionalSteps);
  }
}

export async function denyIfAbusive(
  request: Request,
  kind: AbuseKind,
  now = Date.now(),
): Promise<NextResponse | null> {
  if (kind.requireAccess !== false && !(await isDemoAccessGranted(request, now))) {
    return NextResponse.json(
      { ok: false, error: "Demo access required. Open /unlock." },
      { status: 401 },
    );
  }

  const limits = limitConfig();
  const minute = Math.floor(now / 60_000);
  const ip = clientIp(request);
  const minuteExpires = (minute + 2) * 60_000;

  // Rate limit per minute per IP
  const minuteCheck = await bumpLimit(`ip:${ip}:${minute}`, limits.perMinute, minuteExpires);
  if (!minuteCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait a minute before trying again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const day = utcDay(now);
  const endOfDay = new Date(`${day}T23:59:59.999Z`).getTime();
  const sid = await sessionIdFromRequest(request);

  if (kind.llm) {
    // Check per-session cap first
    if (sid) {
      const sessCheck = await bumpLimit(`sess:${sid}:${day}:llm`, limits.sessionDailyLlm, endOfDay);
      if (!sessCheck.ok) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "You have reached today's demo chat limit for this session. Please come back tomorrow or request extended access.",
          },
          { status: 429, headers: { "Retry-After": "3600" } },
        );
      }
    }

    // Check global daily cap
    const globalCheck = await bumpLimit(`daily:${day}:llm`, limits.dailyLlm, endOfDay);
    if (!globalCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Daily demo LLM budget reached across all testers. Thank you for testing PayPilot! Please come back tomorrow.",
        },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
  }

  if (kind.paypalWrite) {
    const paypalCheck = await bumpLimit(`daily:${day}:paypal`, limits.dailyPaypalWrites, endOfDay);
    if (!paypalCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Daily PayPal sandbox invoice write budget reached. Please try again tomorrow.",
        },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
  }

  return null;
}
