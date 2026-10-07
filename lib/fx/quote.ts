import { z } from "zod";
import { getEnv } from "@/lib/env";

export type FxSource = "live" | "fallback";

export type InrUsdQuote = {
  usdPerInr: number;
  source: FxSource;
  fetchedAt: number;
  asOfDate: string | null;
};

const CACHE_MS = 4 * 60 * 60 * 1000;
const FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rate/inr/usd";

const frankfurterPairSchema = z.object({
  date: z.string().optional(),
  base: z.string().optional(),
  quote: z.string().optional(),
  rate: z.number().positive(),
});

let cache: { quote: InrUsdQuote; storedAt: number } | undefined;

function fallbackQuote(now: number, reason?: string): InrUsdQuote {
  if (reason) {
    console.error("FX live rate unavailable; using env fallback", reason);
  }
  const env = getEnv();
  return {
    usdPerInr: env.INR_USD_RATE,
    source: "fallback",
    fetchedAt: now,
    asOfDate: null,
  };
}

export function resetFxCacheForTests(): void {
  cache = undefined;
}

export async function getInrUsdQuote(now = Date.now()): Promise<InrUsdQuote> {
  if (cache && now - cache.storedAt < CACHE_MS) {
    return cache.quote;
  }

  try {
    const response = await fetch(FRANKFURTER_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return cacheAndReturn(fallbackQuote(now, `HTTP ${response.status}`), now);
    }
    const json: unknown = await response.json();
    const parsed = frankfurterPairSchema.safeParse(json);
    if (!parsed.success) {
      return cacheAndReturn(fallbackQuote(now, "unexpected Frankfurter payload"), now);
    }
    const quote: InrUsdQuote = {
      usdPerInr: parsed.data.rate,
      source: "live",
      fetchedAt: now,
      asOfDate: parsed.data.date ?? null,
    };
    return cacheAndReturn(quote, now);
  } catch (error) {
    return cacheAndReturn(
      fallbackQuote(now, error instanceof Error ? error.message : "fetch failed"),
      now,
    );
  }
}

function cacheAndReturn(quote: InrUsdQuote, now: number): InrUsdQuote {
  cache = { quote, storedAt: now };
  return quote;
}

export function formatUsdPerInr(rate: number): string {
  return rate.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}
