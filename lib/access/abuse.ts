import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { isDemoAccessGranted } from "@/lib/access/demo-code";

export type AbuseKind = {
  requireAccess?: boolean;
  llm?: boolean;
  paypalWrite?: boolean;
};

type LimitConfig = {
  perMinute: number;
  dailyLlm: number;
  dailyPaypalWrites: number;
};

const rateCounts = new Map<string, number>();
const dailyCounts = new Map<string, number>();

function limitConfig(): LimitConfig {
  try {
    const env = getEnv();
    return {
      perMinute: env.RATE_LIMIT_PER_MINUTE,
      dailyLlm: env.DAILY_LLM_CALL_LIMIT,
      dailyPaypalWrites: env.DAILY_PAYPAL_WRITE_LIMIT,
    };
  } catch {
    return { perMinute: 30, dailyLlm: 80, dailyPaypalWrites: 20 };
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function bump(map: Map<string, number>, key: string, limit: number): boolean {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next <= limit;
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function resetAbuseStateForTests(): void {
  rateCounts.clear();
  dailyCounts.clear();
}

export function denyIfAbusive(
  request: Request,
  kind: AbuseKind,
  now = Date.now(),
): NextResponse | null {
  if (kind.requireAccess !== false && !isDemoAccessGranted(request)) {
    return NextResponse.json(
      { ok: false, error: "Demo access required. Open /unlock." },
      { status: 401 },
    );
  }

  const limits = limitConfig();
  const minute = Math.floor(now / 60_000);
  const ip = clientIp(request);
  if (!bump(rateCounts, `${ip}:${minute}`, limits.perMinute)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const day = utcDay(now);
  if (kind.llm && !bump(dailyCounts, `${day}:llm`, limits.dailyLlm)) {
    return NextResponse.json(
      { ok: false, error: "Daily LLM budget reached." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  if (kind.paypalWrite && !bump(dailyCounts, `${day}:paypal`, limits.dailyPaypalWrites)) {
    return NextResponse.json(
      { ok: false, error: "Daily PayPal write budget reached." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  return null;
}
