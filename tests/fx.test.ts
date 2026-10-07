import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { getInrUsdQuote, resetFxCacheForTests } from "@/lib/fx/quote";

describe("getInrUsdQuote", () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.PAYPAL_MODE = "sandbox";
    process.env.INR_USD_RATE = "0.012";
    resetEnvCache();
    resetFxCacheForTests();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetFxCacheForTests();
    resetEnvCache();
  });

  it("uses the Frankfurter live rate and caches it", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ date: "2026-10-07", base: "INR", quote: "USD", rate: 0.01037 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const first = await getInrUsdQuote(1_000);
    const second = await getInrUsdQuote(1_000 + 60_000);

    expect(first).toMatchObject({
      usdPerInr: 0.01037,
      source: "live",
      asOfDate: "2026-10-07",
    });
    expect(second.usdPerInr).toBe(0.01037);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/rate/inr/usd");
  });

  it("falls back to INR_USD_RATE when Frankfurter fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const quote = await getInrUsdQuote(2_000);
    expect(quote).toMatchObject({ usdPerInr: 0.012, source: "fallback", asOfDate: null });
  });
});
