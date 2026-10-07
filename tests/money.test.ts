import { describe, expect, it } from "vitest";
import { centsToAmountString, parseChatAmount, paypalMajorToCents, usdCentsFromInrPaise } from "@/lib/money";

describe("parseChatAmount", () => {
  it("parses $480 as USD cents", () => {
    expect(parseChatAmount("please invoice $480 for the landing page")).toEqual({
      currency: "USD",
      majorUnits: 480,
      minorUnits: 48000,
    });
  });

  it("parses 40k as USD thousands", () => {
    expect(parseChatAmount("40k for the redesign")).toEqual({
      currency: "USD",
      majorUnits: 40000,
      minorUnits: 4_000_000,
    });
  });

  it("parses ₹40,000 as INR paise", () => {
    expect(parseChatAmount("client agreed ₹40,000")).toEqual({
      currency: "INR",
      majorUnits: 40000,
      minorUnits: 4_000_000,
    });
  });

  it("parses $480.50 and Rs. 1,200", () => {
    expect(parseChatAmount("$480.50")).toEqual({
      currency: "USD",
      majorUnits: 480.5,
      minorUnits: 48050,
    });
    expect(parseChatAmount("Rs. 1,200")).toEqual({
      currency: "INR",
      majorUnits: 1200,
      minorUnits: 120000,
    });
  });

  it("returns null for empty or negative amounts", () => {
    expect(parseChatAmount("no money here")).toBeNull();
    expect(parseChatAmount("refund -$20")).toBeNull();
  });

  it("takes the later amount after a revision cue", () => {
    expect(parseChatAmount("quoted $400 for a landing page, they agreed $480")).toEqual({
      currency: "USD",
      majorUnits: 480,
      minorUnits: 48000,
    });
    expect(parseChatAmount("not $120 — please bill $220 for the icons")).toEqual({
      currency: "USD",
      majorUnits: 220,
      minorUnits: 22000,
    });
  });

  it("refuses euros, mixed currencies, and two client emails", () => {
    expect(parseChatAmount("invoice 480 euros for the logo refresh")).toBeNull();
    expect(parseChatAmount("same job is ₹40,000 or $480, not sure which")).toBeNull();
    expect(
      parseChatAmount(
        "Invoice Acme $120 (acme@example.com) and also Northwind $750 (ap@northwind.example)",
      ),
    ).toBeNull();
  });

  it("skips ISO date years and prefers currency-marked amounts", () => {
    expect(parseChatAmount("On 2026-11-01 please invoice $220 for hosting")).toEqual({
      currency: "USD",
      majorUnits: 220,
      minorUnits: 22000,
    });
    expect(
      parseChatAmount("We spoke 2 weeks ago. Please invoice $1,250.00 to ap@northwind.example"),
    ).toEqual({
      currency: "USD",
      majorUnits: 1250,
      minorUnits: 125000,
    });
  });
});

describe("usdCentsFromInrPaise", () => {
  it("converts ₹40,000 at the labeled 0.012 demo rate to $480", () => {
    expect(usdCentsFromInrPaise(4_000_000, 0.012)).toBe(48000);
    expect(centsToAmountString(48000)).toBe("480.00");
  });
});

describe("paypalMajorToCents", () => {
  it("parses PayPal amount.value as integer cents", () => {
    expect(paypalMajorToCents("74.21")).toBe(7421);
    expect(paypalMajorToCents("480")).toBe(48000);
    expect(paypalMajorToCents("0.50")).toBe(50);
  });

  it("rejects more than two decimal places", () => {
    expect(paypalMajorToCents("1.234")).toBeNull();
    expect(paypalMajorToCents("-12.00")).toBeNull();
  });
});
