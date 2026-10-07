import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/invoices/cron-auth";
import { resetEnvCache } from "@/lib/env";

function request(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost/api/cron/overdue", { method: "POST", headers });
}

describe("isCronAuthorized", () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.PAYPAL_MODE = "sandbox";
    resetEnvCache();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    resetEnvCache();
  });

  it("allows local calls when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    resetEnvCache();
    expect(isCronAuthorized(request())).toBe(true);
  });

  it("requires a matching Bearer token when CRON_SECRET is set", () => {
    process.env.CRON_SECRET = "cron-secret";
    resetEnvCache();
    expect(isCronAuthorized(request())).toBe(false);
    expect(isCronAuthorized(request("Bearer wrong"))).toBe(false);
    expect(isCronAuthorized(request("Bearer cron-secret"))).toBe(true);
  });
});
