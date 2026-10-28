import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/simulate/route";
import { DEMO_ACCESS_COOKIE } from "@/lib/access/demo-code";
import { resetEnvCache } from "@/lib/core/env";

describe("webhook simulator security gate (A3)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PAYPAL_MODE = "sandbox";
    process.env.DEMO_ACCESS_CODE = "gate-secret";
    delete process.env.ENABLE_SIMULATOR;
    resetEnvCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCache();
  });

  it("rejects unauthenticated requests with 401 when DEMO_ACCESS_CODE is set", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "test-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Demo access required");
  });

  it("blocks simulator in production builds unless ENABLE_SIMULATOR=true", async () => {
    // NODE_ENV is typed readonly on ProcessEnv; tests still need to flip it at runtime.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.ENABLE_SIMULATOR;

    const req = new Request("http://localhost:3000/api/webhooks/simulate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${DEMO_ACCESS_COOKIE}=gate-secret`,
      },
      body: JSON.stringify({ invoiceId: "test-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("disabled in production");
  });

  it("permits simulator in production if ENABLE_SIMULATOR=true and authenticated", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.ENABLE_SIMULATOR = "true";

    // Will proceed past gate checks to invoice lookup
    const req = new Request("http://localhost:3000/api/webhooks/simulate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${DEMO_ACCESS_COOKIE}=gate-secret`,
      },
      body: JSON.stringify({ invoiceId: "nonexistent-id" }),
    });

    const res = await POST(req);
    // Gate passed; invoice not found gives 404
    expect(res.status).toBe(404);
  });
});
