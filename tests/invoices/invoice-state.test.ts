import { describe, expect, it } from "vitest";
import {
  applyWebhookStatus,
  assertTransition,
  canTransition,
  displayStatus,
  InvoiceTransitionError,
  mapPaypalInvoiceStatus,
  transition,
} from "@/lib/invoices/state";

describe("invoice status transitions", () => {
  it("allows DRAFT -> SENT -> PAID", () => {
    expect(transition("DRAFT", "SENT")).toBe("SENT");
    expect(transition("SENT", "PAID")).toBe("PAID");
  });

  it("allows SENT -> CANCELLED", () => {
    expect(transition("SENT", "CANCELLED")).toBe("CANCELLED");
  });

  it("treats the same status as a no-op for user actions", () => {
    expect(transition("SENT", "SENT")).toBe("SENT");
    expect(() => assertTransition("PAID", "PAID")).not.toThrow();
  });

  it("rejects skipping SENT (DRAFT -> PAID)", () => {
    expect(canTransition("DRAFT", "PAID")).toBe(false);
    expect(() => transition("DRAFT", "PAID")).toThrow(InvoiceTransitionError);
  });

  it("rejects leaving terminal statuses", () => {
    expect(() => transition("PAID", "CANCELLED")).toThrow(InvoiceTransitionError);
    expect(() => transition("CANCELLED", "PAID")).toThrow(InvoiceTransitionError);
    expect(() => transition("PAID", "SENT")).toThrow(InvoiceTransitionError);
  });
});

describe("webhook status application", () => {
  it("applies a legal forward transition", () => {
    expect(applyWebhookStatus("SENT", "PAID")).toEqual({ applied: true, status: "PAID" });
  });

  it("ignores duplicate events", () => {
    expect(applyWebhookStatus("PAID", "PAID")).toEqual({ applied: false, reason: "noop" });
  });

  it("ignores out-of-order SENT after PAID", () => {
    expect(applyWebhookStatus("PAID", "SENT")).toEqual({ applied: false, reason: "stale" });
  });

  it("ignores CREATED/DRAFT after the invoice was already sent", () => {
    expect(applyWebhookStatus("SENT", "DRAFT")).toEqual({ applied: false, reason: "stale" });
  });

  it("ignores DRAFT jumping to PAID instead of throwing", () => {
    expect(applyWebhookStatus("DRAFT", "PAID")).toEqual({ applied: false, reason: "illegal" });
  });
});

describe("PayPal status mapping", () => {
  it("maps paid variants to PAID", () => {
    expect(mapPaypalInvoiceStatus("PAID")).toBe("PAID");
    expect(mapPaypalInvoiceStatus("MARKED_AS_PAID")).toBe("PAID");
  });

  it("maps unpaid variants to SENT", () => {
    expect(mapPaypalInvoiceStatus("SENT")).toBe("SENT");
    expect(mapPaypalInvoiceStatus("PARTIALLY_PAID")).toBe("SENT");
    expect(mapPaypalInvoiceStatus("SCHEDULED")).toBe("SENT");
  });

  it("returns undefined for unknown statuses", () => {
    expect(mapPaypalInvoiceStatus("REFUNDED")).toBeUndefined();
  });
});

describe("derived OVERDUE", () => {
  const now = Date.parse("2026-10-08T00:00:00.000Z");

  it("marks SENT invoices past due as OVERDUE", () => {
    expect(
      displayStatus({ status: "SENT", dueDate: now - 1 }, now),
    ).toBe("OVERDUE");
  });

  it("does not mark future SENT invoices overdue", () => {
    expect(
      displayStatus({ status: "SENT", dueDate: now + 86_400_000 }, now),
    ).toBe("SENT");
  });

  it("does not override PAID or CANCELLED", () => {
    expect(displayStatus({ status: "PAID", dueDate: now - 1 }, now)).toBe("PAID");
    expect(displayStatus({ status: "CANCELLED", dueDate: now - 1 }, now)).toBe("CANCELLED");
    expect(displayStatus({ status: "DRAFT", dueDate: now - 1 }, now)).toBe("DRAFT");
  });
});
