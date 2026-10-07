import { describe, expect, it } from "vitest";
import { centsToAmountString, parseChatAmount, usdCentsFromInrPaise } from "@/lib/money";

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
});

describe("usdCentsFromInrPaise", () => {
  it("converts ₹40,000 at the labeled 0.012 demo rate to $480", () => {
    expect(usdCentsFromInrPaise(4_000_000, 0.012)).toBe(48000);
    expect(centsToAmountString(48000)).toBe("480.00");
  });
});
