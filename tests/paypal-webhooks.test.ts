import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { resetPaypalTokenCache } from "@/lib/paypal/client";

vi.mock("@/lib/paypal/invoicing", () => ({
  getInvoice: vi.fn(),
  hostedUrlFromInvoice: vi.fn(() => undefined),
}));

vi.mock("@/lib/db/repositories/invoices", () => ({
  getInvoiceById: vi.fn(),
  getInvoiceByPaypalId: vi.fn(),
  updateInvoice: vi.fn(),
}));

vi.mock("@/lib/db/repositories/audit-log", () => ({
  insertAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/repositories/webhook-events", () => ({
  recordWebhookEvent: vi.fn(),
  getWebhookEvent: vi.fn(),
}));

import { getInvoice } from "@/lib/paypal/invoicing";
import { getInvoiceByPaypalId, updateInvoice } from "@/lib/db/repositories/invoices";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { recordWebhookEvent } from "@/lib/db/repositories/webhook-events";
import { handlePaypalWebhookEvent } from "@/lib/invoices/webhooks";
import { verifyPaypalWebhookSignature } from "@/lib/paypal/webhooks";
import type { InvoiceRow } from "@/lib/db/schema";

const getInvoiceMock = vi.mocked(getInvoice);
const getInvoiceByPaypalIdMock = vi.mocked(getInvoiceByPaypalId);
const updateInvoiceMock = vi.mocked(updateInvoice);
const insertAuditLogMock = vi.mocked(insertAuditLog);
const recordWebhookEventMock = vi.mocked(recordWebhookEvent);

const local: InvoiceRow = {
  id: "inv-1",
  paypalInvoiceId: "INV2-WH",
  paypalInvoiceNumber: "0009",
  clientId: "client-1",
  amountCents: 5000,
  currency: "USD",
  status: "SENT",
  dueDate: null,
  issuedAt: 1,
  paidAt: null,
  hostedUrl: null,
  lineItems: [{ name: "Fix", quantity: 1, unitAmountCents: 5000 }],
  createdBy: "agent",
  note: null,
  originalAmountCents: null,
  originalCurrency: null,
  fxRate: null,
  isDemo: false,
  createdAt: 1,
  updatedAt: 1,
};

describe("verifyPaypalWebhookSignature", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.PAYPAL_MODE = "sandbox";
    process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
    resetEnvCache();
    resetPaypalTokenCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetEnvCache();
    resetPaypalTokenCache();
  });

  it("posts transmission headers and the event object to PayPal", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-1", token_type: "Bearer", expires_in: 32400 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const event = { id: "WH-1", event_type: "INVOICING.INVOICE.PAID", resource: { id: "INV2-WH" } };
    const ok = await verifyPaypalWebhookSignature({
      headers: {
        authAlgo: "SHA256withRSA",
        certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
        transmissionId: "tx-1",
        transmissionSig: "sig",
        transmissionTime: "2026-10-08T00:00:00Z",
      },
      webhookEvent: event,
    });

    expect(ok).toBe(true);
    const verifyCall = fetchMock.mock.calls[1];
    expect(verifyCall).toBeDefined();
    const [url, init] = verifyCall as [string, RequestInit];
    expect(String(url)).toContain("/v1/notifications/verify-webhook-signature");
    expect(JSON.parse(String(init.body))).toMatchObject({
      webhook_id: "WH-TEST",
      transmission_id: "tx-1",
      webhook_event: event,
    });
  });
});

describe("handlePaypalWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordWebhookEventMock.mockResolvedValue(true);
    getInvoiceByPaypalIdMock.mockResolvedValue(local);
    getInvoiceMock.mockResolvedValue({ id: "INV2-WH", status: "PAID" });
    updateInvoiceMock.mockImplementation(async (id, patch) => ({ ...local, ...patch, id }));
  });

  it("applies PAID and writes an audit row", async () => {
    const result = await handlePaypalWebhookEvent({
      id: "WH-NEW",
      event_type: "INVOICING.INVOICE.PAID",
      resource: { id: "INV2-WH", status: "PAID" },
    });
    expect(result).toMatchObject({ duplicate: false, applied: true, invoiceId: "inv-1" });
    expect(updateInvoiceMock).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ status: "PAID" }),
    );
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "webhook", action: "sync_paypal_status" }),
    );
  });

  it("returns duplicate without calling PayPal", async () => {
    recordWebhookEventMock.mockResolvedValue(false);
    const result = await handlePaypalWebhookEvent({
      id: "WH-DUP",
      event_type: "INVOICING.INVOICE.PAID",
      resource: { id: "INV2-WH" },
    });
    expect(result.duplicate).toBe(true);
    expect(getInvoiceMock).not.toHaveBeenCalled();
  });

  it("ignores events for unknown local invoices", async () => {
    getInvoiceByPaypalIdMock.mockResolvedValue(undefined);
    const result = await handlePaypalWebhookEvent({
      id: "WH-MISS",
      event_type: "INVOICING.INVOICE.PAID",
      resource: { id: "INV2-UNKNOWN" },
    });
    expect(result).toMatchObject({ ignored: true, reason: "unknown_invoice" });
  });
});
