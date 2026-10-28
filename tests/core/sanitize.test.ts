import { describe, expect, it } from "vitest";
import { sanitizeEmail, sanitizeUntrustedText } from "@/lib/core/sanitize";

describe("sanitizeUntrustedText", () => {
  it("strips tags, schemes, and control characters", () => {
    expect(sanitizeUntrustedText("<b>Acme</b> <script>alert(1)</script>")).toBe(
      "Acme alert(1)",
    );
    expect(sanitizeUntrustedText("click javascript:alert(1) now")).toBe("click alert(1) now");
    expect(sanitizeUntrustedText("ok\u0000\u200B done")).toBe("ok done");
  });

  it("caps length", () => {
    expect(sanitizeUntrustedText("abcdefghij", 4)).toBe("abcd");
  });
});

describe("sanitizeEmail", () => {
  it("lowercases a valid address", () => {
    expect(sanitizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
  });

  it("rejects junk", () => {
    expect(sanitizeEmail("not-an-email")).toBeNull();
    expect(sanitizeEmail("")).toBeNull();
  });
});
