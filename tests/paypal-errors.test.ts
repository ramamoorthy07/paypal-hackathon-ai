import { describe, expect, it } from "vitest";
import { paypalErrorFromHttp } from "@/lib/paypal/errors";

describe("paypalErrorFromHttp", () => {
  it("maps AUTHENTICATION_FAILURE to a credential message", () => {
    const error = paypalErrorFromHttp(401, {
      name: "AUTHENTICATION_FAILURE",
      message: "Authentication failed",
      debug_id: "abc123",
    });

    expect(error.paypalName).toBe("AUTHENTICATION_FAILURE");
    expect(error.status).toBe(401);
    expect(error.debugId).toBe("abc123");
    expect(error.message).toContain("PAYPAL_CLIENT_ID");
  });

  it("appends 422 field details without exposing secrets", () => {
    const error = paypalErrorFromHttp(422, {
      name: "UNPROCESSABLE_ENTITY",
      message: "Invalid request",
      details: [
        {
          field: "/items/0/unit_amount/value",
          issue: "INVALID_PARAMETER_VALUE",
          description: "Must have 2 decimal places.",
        },
      ],
    });

    expect(error.paypalName).toBe("UNPROCESSABLE_ENTITY");
    expect(error.message).toContain("could not process this invoice");
    expect(error.message).toContain("INVALID_PARAMETER_VALUE");
    expect(error.message).toContain("/items/0/unit_amount/value");
    expect(error.message.toLowerCase()).not.toContain("secret");
  });

  it("maps INSTRUMENT_DECLINED for buyer funding failures", () => {
    const error = paypalErrorFromHttp(422, {
      name: "INSTRUMENT_DECLINED",
      message: "The instrument presented was declined",
    });

    expect(error.message).toContain("declined");
  });

  it("falls back when the body is not JSON", () => {
    const error = paypalErrorFromHttp(500, undefined, "upstream exploded");
    expect(error.paypalName).toBe("HTTP_500");
    expect(error.message).toContain("upstream exploded");
  });
});
