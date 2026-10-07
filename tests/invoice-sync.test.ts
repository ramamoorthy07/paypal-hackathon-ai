import { describe, expect, it } from "vitest";
import { patchFromPaypalInvoice } from "@/lib/invoices/sync";
import type { InvoiceRow } from "@/lib/db/schema";
import { extractPaypalInvoiceId, isPaypalCertUrl } from "@/lib/paypal/webhooks";

function sentInvoice(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv-1",
    paypalInvoiceId: "INV2-TEST",
    paypalInvoiceNumber: "0001",
    clientId: "client-1",
    amountCents: 12000,
    currency: "USD",
    status: "SENT",
    dueDate: null,
    issuedAt: 1,
    paidAt: null,
    hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-TEST",
    lineItems: [{ name: "Logo", quantity: 1, unitAmountCents: 12000 }],
    createdBy: "agent",
    note: null,
    originalAmountCents: null,
    originalCurrency: null,
    fxRate: null,
    isDemo: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("patchFromPaypalInvoice", () => {
  it("marks a SENT invoice PAID and sets paidAt", () => {
    const now = 1_700_000_000_000;
    const result = patchFromPaypalInvoice(
      sentInvoice(),
      { id: "INV2-TEST", status: "PAID", detail: { invoice_number: "0001" } },
      now,
    );
    expect(result.applied).toBe(true);
    expect(result.patch).toMatchObject({ status: "PAID", paidAt: now });
  });

  it("ignores a stale SENT event after PAID", () => {
    const result = patchFromPaypalInvoice(sentInvoice({ status: "PAID", paidAt: 9 }), {
      id: "INV2-TEST",
      status: "UNPAID",
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("stale");
    expect(result.patch.status).toBeUndefined();
  });

  it("does not jump DRAFT to PAID", () => {
    const result = patchFromPaypalInvoice(sentInvoice({ status: "DRAFT", paypalInvoiceId: null }), {
      id: "INV2-NEW",
      status: "PAID",
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("illegal");
  });
});

describe("PayPal webhook helpers", () => {
  it("accepts PayPal certificate hosts only", () => {
    expect(isPaypalCertUrl("https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1")).toBe(
      true,
    );
    expect(isPaypalCertUrl("https://evil.example/cert")).toBe(false);
    expect(isPaypalCertUrl("http://api.paypal.com/cert")).toBe(false);
  });

  it("extracts invoicing ids from nested resources", () => {
    expect(extractPaypalInvoiceId({ id: "INV2-ABC" })).toBe("INV2-ABC");
    expect(extractPaypalInvoiceId({ invoice_id: "INV2-DEF" })).toBe("INV2-DEF");
    expect(extractPaypalInvoiceId({ invoice: { id: "INV2-GHI" } })).toBe("INV2-GHI");
  });
});
