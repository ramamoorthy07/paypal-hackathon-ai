import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import type { ClientRow, InvoiceRow } from "@/lib/db/schema";

vi.mock("@/lib/paypal/invoicing", () => ({
  createDraftInvoice: vi.fn(),
  sendInvoiceAsShareLink: vi.fn(),
}));

vi.mock("@/lib/db/repositories/invoices", () => ({
  getInvoiceById: vi.fn(),
  updateInvoice: vi.fn(),
}));

vi.mock("@/lib/db/repositories/clients", () => ({
  getClientById: vi.fn(),
}));

vi.mock("@/lib/db/repositories/audit-log", () => ({
  insertAuditLog: vi.fn(),
}));

import { createDraftInvoice, sendInvoiceAsShareLink } from "@/lib/paypal/invoicing";
import { getInvoiceById, updateInvoice } from "@/lib/db/repositories/invoices";
import { getClientById } from "@/lib/db/repositories/clients";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { ConfirmError, confirmInvoice } from "@/lib/invoices/confirm";

const createDraftInvoiceMock = vi.mocked(createDraftInvoice);
const sendInvoiceAsShareLinkMock = vi.mocked(sendInvoiceAsShareLink);
const getInvoiceByIdMock = vi.mocked(getInvoiceById);
const updateInvoiceMock = vi.mocked(updateInvoice);
const getClientByIdMock = vi.mocked(getClientById);
const insertAuditLogMock = vi.mocked(insertAuditLog);

const client: ClientRow = {
  id: "client-1",
  name: "Acme Studio",
  email: "acme@example.com",
  isDemo: false,
  createdAt: 1,
};

function draft(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv-1",
    paypalInvoiceId: null,
    paypalInvoiceNumber: null,
    clientId: client.id,
    amountCents: 12000,
    currency: "USD",
    status: "DRAFT",
    dueDate: null,
    issuedAt: null,
    paidAt: null,
    hostedUrl: null,
    lineItems: [{ name: "Logo refresh", quantity: 1, unitAmountCents: 12000 }],
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

describe("confirmInvoice", () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.PAYPAL_MODE = "sandbox";
    process.env.MAX_INVOICE_USD = "5000";
    resetEnvCache();
    vi.clearAllMocks();
    getClientByIdMock.mockResolvedValue(client);
    updateInvoiceMock.mockImplementation(async (id, patch) => {
      const current = (await getInvoiceByIdMock(id)) ?? draft({ id });
      const next = { ...current, ...patch, id, updatedAt: 2 };
      getInvoiceByIdMock.mockResolvedValue(next);
      return next;
    });
  });

  afterEach(() => {
    resetEnvCache();
  });

  it("creates a PayPal draft, sends a share link, and marks the local invoice SENT", async () => {
    getInvoiceByIdMock.mockResolvedValue(draft());
    createDraftInvoiceMock.mockResolvedValue({
      id: "INV2-NEW",
      status: "DRAFT",
      detail: { invoice_number: "PP-1" },
    });
    sendInvoiceAsShareLinkMock.mockResolvedValue({
      hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-NEW",
    });

    const result = await confirmInvoice("inv-1");

    expect(createDraftInvoiceMock).toHaveBeenCalledOnce();
    expect(sendInvoiceAsShareLinkMock).toHaveBeenCalledWith({
      paypalInvoiceId: "INV2-NEW",
      localInvoiceId: "inv-1",
    });
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "user", action: "confirm_invoice", invoiceId: "inv-1" }),
    );
    expect(result).toMatchObject({
      status: "SENT",
      paypalInvoiceId: "INV2-NEW",
      hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-NEW",
      alreadySent: false,
    });
  });

  it("returns an already-sent invoice without calling PayPal", async () => {
    getInvoiceByIdMock.mockResolvedValue(
      draft({
        status: "SENT",
        paypalInvoiceId: "INV2-OLD",
        hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-OLD",
      }),
    );

    const result = await confirmInvoice("inv-1");

    expect(createDraftInvoiceMock).not.toHaveBeenCalled();
    expect(sendInvoiceAsShareLinkMock).not.toHaveBeenCalled();
    expect(result.alreadySent).toBe(true);
    expect(result.hostedUrl).toContain("INV2-OLD");
  });

  it("retries send when a PayPal draft already exists locally", async () => {
    getInvoiceByIdMock.mockResolvedValue(draft({ paypalInvoiceId: "INV2-RETRY" }));
    sendInvoiceAsShareLinkMock.mockResolvedValue({
      hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-RETRY",
    });

    await confirmInvoice("inv-1");

    expect(createDraftInvoiceMock).not.toHaveBeenCalled();
    expect(sendInvoiceAsShareLinkMock).toHaveBeenCalledWith({
      paypalInvoiceId: "INV2-RETRY",
      localInvoiceId: "inv-1",
    });
  });

  it("rejects non-draft invoices and amounts over the cap without PayPal", async () => {
    getInvoiceByIdMock.mockResolvedValue(draft({ status: "PAID", paypalInvoiceId: "INV2-PAID" }));
    await expect(confirmInvoice("inv-1")).rejects.toMatchObject({
      name: "ConfirmError",
      status: 409,
      code: "illegal_status",
    } satisfies Partial<ConfirmError>);
    expect(createDraftInvoiceMock).not.toHaveBeenCalled();

    getInvoiceByIdMock.mockResolvedValue(draft({ amountCents: 500_001 }));
    await expect(confirmInvoice("inv-1")).rejects.toMatchObject({ code: "over_limit", status: 422 });
    expect(sendInvoiceAsShareLinkMock).not.toHaveBeenCalled();
  });

  it("returns not_found when the invoice is missing", async () => {
    getInvoiceByIdMock.mockResolvedValue(undefined);
    await expect(confirmInvoice("missing")).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
  });
});
