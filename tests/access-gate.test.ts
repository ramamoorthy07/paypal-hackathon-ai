import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { denyIfAbusive, resetAbuseStateForTests } from "@/lib/access/abuse";
import {
  DEMO_ACCESS_COOKIE,
  createSignedToken,
  isDemoAccessGranted,
  isDemoProtectedPath,
  timingSafeEqualString,
} from "@/lib/access/demo-code";
import { resetEnvCache } from "@/lib/env";
import { publicEnv, publicPaypal } from "@/lib/health/public";

function request(path: string, init?: { cookie?: string; ip?: string }): Request {
  const headers = new Headers();
  if (init?.cookie) {
    headers.set("cookie", init.cookie);
  }
  if (init?.ip) {
    headers.set("x-forwarded-for", init.ip);
  }
  return new Request(`http://localhost${path}`, { method: "POST", headers });
}

describe("demo access paths", () => {
  it("gates pages and sensitive endpoints while exempting health, webhooks, cron, mcp, and unlock", () => {
    expect(isDemoProtectedPath("/api/chat")).toBe(true);
    expect(isDemoProtectedPath("/api/invoices/confirm")).toBe(true);
    expect(isDemoProtectedPath("/api/invoices/inv-1/remind")).toBe(true);
    expect(isDemoProtectedPath("/api/invoices/inv-1/sync")).toBe(true);
    expect(isDemoProtectedPath("/api/fx")).toBe(true);
    expect(isDemoProtectedPath("/dashboard")).toBe(true);
    expect(isDemoProtectedPath("/invoices")).toBe(true);

    expect(isDemoProtectedPath("/unlock")).toBe(false);
    expect(isDemoProtectedPath("/api/unlock")).toBe(false);
    expect(isDemoProtectedPath("/api/health")).toBe(false);
    expect(isDemoProtectedPath("/api/health/live")).toBe(false);
    expect(isDemoProtectedPath("/api/webhooks/paypal")).toBe(false);
    expect(isDemoProtectedPath("/api/cron/overdue")).toBe(false);
    expect(isDemoProtectedPath("/api/mcp")).toBe(false);
  });
});

describe("timingSafeEqualString", () => {
  it("accepts equal codes and rejects mismatches without throwing on length", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
    expect(timingSafeEqualString("secret", "wrong")).toBe(false);
    expect(timingSafeEqualString("ab", "abcd")).toBe(false);
  });
});

describe("isDemoAccessGranted", () => {
  afterEach(() => {
    delete process.env.DEMO_ACCESS_CODE;
    resetEnvCache();
  });

  it("allows local requests when no demo code is configured", () => {
    delete process.env.DEMO_ACCESS_CODE;
    expect(isDemoAccessGranted(request("/api/chat"))).toBe(true);
  });

    it("requires the httpOnly cookie when DEMO_ACCESS_CODE is set", () => {
    process.env.DEMO_ACCESS_CODE = "gate-secret";
    expect(isDemoAccessGranted(request("/api/chat"))).toBe(false);
    expect(
      isDemoAccessGranted(
        request("/api/chat", { cookie: `${DEMO_ACCESS_COOKIE}=wrong` }),
      ),
    ).toBe(false);
    expect(
      isDemoAccessGranted(
        request("/api/chat", { cookie: `${DEMO_ACCESS_COOKIE}=gate-secret` }),
      ),
    ).toBe(true);
  });

  it("validates cryptographically signed HMAC session tokens", () => {
    process.env.DEMO_ACCESS_CODE = "gate-secret";
    process.env.DEMO_COOKIE_SECRET = "super-secret-key-123";
    const now = Date.parse("2026-10-10T12:00:00.000Z");
    const token = createSignedToken({ now, secret: "super-secret-key-123" });

    // Valid signed token
    expect(
      isDemoAccessGranted(
        request("/api/chat", { cookie: `${DEMO_ACCESS_COOKIE}=${token}` }),
        now,
      ),
    ).toBe(true);

    // Tampered signed token
    const tampered = token.slice(0, -4) + "abcd";
    expect(
      isDemoAccessGranted(
        request("/api/chat", { cookie: `${DEMO_ACCESS_COOKIE}=${tampered}` }),
        now,
      ),
    ).toBe(false);

    // Expired signed token (older than 7 days)
    const eightDaysLater = now + 8 * 24 * 60 * 60 * 1000;
    expect(
      isDemoAccessGranted(
        request("/api/chat", { cookie: `${DEMO_ACCESS_COOKIE}=${token}` }),
        eightDaysLater,
      ),
    ).toBe(false);
  });
});

describe("denyIfAbusive", () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.PAYPAL_MODE = "sandbox";
    process.env.DEMO_ACCESS_CODE = "gate-secret";
    process.env.RATE_LIMIT_PER_MINUTE = "3";
    process.env.DAILY_LLM_CALL_LIMIT = "2";
    process.env.DAILY_PAYPAL_WRITE_LIMIT = "1";
    resetEnvCache();
    resetAbuseStateForTests();
  });

  afterEach(() => {
    delete process.env.DEMO_ACCESS_CODE;
    delete process.env.RATE_LIMIT_PER_MINUTE;
    delete process.env.DAILY_LLM_CALL_LIMIT;
    delete process.env.DAILY_PAYPAL_WRITE_LIMIT;
    resetEnvCache();
    resetAbuseStateForTests();
  });

  it("returns 401 without the demo cookie", async () => {
    const denied = await denyIfAbusive(request("/api/chat"), { llm: true });
    expect(denied?.status).toBe(401);
    await expect(denied?.json()).resolves.toMatchObject({ ok: false });
  });

  it("rate-limits per IP after the configured number of allowed calls", async () => {
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    const kind = { requireAccess: false };
    expect(await denyIfAbusive(request("/api/unlock", { ip: "10.0.0.1" }), kind, now)).toBeNull();
    expect(await denyIfAbusive(request("/api/unlock", { ip: "10.0.0.1" }), kind, now)).toBeNull();
    expect(await denyIfAbusive(request("/api/unlock", { ip: "10.0.0.1" }), kind, now)).toBeNull();
    expect((await denyIfAbusive(request("/api/unlock", { ip: "10.0.0.1" }), kind, now))?.status).toBe(429);
    expect(await denyIfAbusive(request("/api/unlock", { ip: "10.0.0.2" }), kind, now)).toBeNull();
  });

  it("enforces a daily LLM budget", async () => {
    const cookie = `${DEMO_ACCESS_COOKIE}=gate-secret`;
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    expect(await denyIfAbusive(request("/api/chat", { cookie, ip: "10.0.0.3" }), { llm: true }, now)).toBeNull();
    expect(await denyIfAbusive(request("/api/chat", { cookie, ip: "10.0.0.4" }), { llm: true }, now)).toBeNull();
    expect(
      (await denyIfAbusive(request("/api/chat", { cookie, ip: "10.0.0.5" }), { llm: true }, now))?.status,
    ).toBe(429);
  });

  it("enforces a daily PayPal write budget", async () => {
    const cookie = `${DEMO_ACCESS_COOKIE}=gate-secret`;
    const now = Date.parse("2026-10-08T12:00:00.000Z");
    expect(
      await denyIfAbusive(
        request("/api/invoices/confirm", { cookie, ip: "10.0.0.9" }),
        { paypalWrite: true },
        now,
      ),
    ).toBeNull();
    expect(
      (
        await denyIfAbusive(
          request("/api/invoices/confirm", { cookie, ip: "10.0.0.8" }),
          { paypalWrite: true },
          now,
        )
      )?.status,
    ).toBe(429);
  });
});

describe("public health payload", () => {
  it("omits env dumps, PayPal debug ids, and error internals", () => {
    expect(
      publicEnv({
        ok: false,
        message: "Invalid environment variables.\n- PAYPAL_CLIENT_SECRET: required",
      }),
    ).toEqual({ ok: false });
    expect(
      publicPaypal({
        ok: false,
        message: "AUTHENTICATION_FAILURE",
        debugId: "abc123",
        paypalName: "AUTHENTICATION_FAILURE",
      }),
    ).toEqual({ ok: false });
  });
});
