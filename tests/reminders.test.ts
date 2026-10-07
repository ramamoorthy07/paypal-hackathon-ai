import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import type { InvoiceView } from "@/lib/invoices/views";
import type { ReminderRow } from "@/lib/db/schema";

vi.mock("@/lib/paypal/invoicing", () => ({
  remindInvoice: vi.fn(),
}));

vi.mock("@/lib/invoices/views", () => ({
  getInvoiceView: vi.fn(),
  listInvoiceViews: vi.fn(),
}));

vi.mock("@/lib/db/repositories/reminders", () => ({
  countRemindersSince: vi.fn(),
  insertReminder: vi.fn(),
}));

vi.mock("@/lib/db/repositories/audit-log", () => ({
  insertAuditLog: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

import { generateText } from "ai";
import { remindInvoice } from "@/lib/paypal/invoicing";
import { getInvoiceView, listInvoiceViews } from "@/lib/invoices/views";
import { countRemindersSince, insertReminder } from "@/lib/db/repositories/reminders";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { RemindError, runOverdueReminderSweep, sendOverdueReminder } from "@/lib/invoices/remind";

const remindInvoiceMock = vi.mocked(remindInvoice);
const getInvoiceViewMock = vi.mocked(getInvoiceView);
const listInvoiceViewsMock = vi.mocked(listInvoiceViews);
const countRemindersSinceMock = vi.mocked(countRemindersSince);
const insertReminderMock = vi.mocked(insertReminder);
const insertAuditLogMock = vi.mocked(insertAuditLog);
const generateTextMock = vi.mocked(generateText);

const now = Date.parse("2026-10-08T12:00:00.000Z");

function overdueView(overrides: Partial<InvoiceView> = {}): InvoiceView {
  return {
    id: "inv-overdue",
    paypalInvoiceId: "INV2-TEST",
    paypalInvoiceNumber: null,
    clientId: "c1",
    amountCents: 75000,
    currency: "USD",
    status: "SENT",
    dueDate: Date.parse("2026-09-23T00:00:00.000Z"),
    issuedAt: now,
    paidAt: null,
    hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-TEST",
    lineItems: [{ name: "Landing page", quantity: 1, unitAmountCents: 75000 }],
    createdBy: "seed",
    note: null,
    originalAmountCents: null,
    originalCurrency: null,
    fxRate: null,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    clientName: "Northwind LLC",
    clientEmail: "ap@northwind.example",
    displayStatus: "OVERDUE",
    ...overrides,
  };
}

describe("sendOverdueReminder", () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.PAYPAL_MODE = "sandbox";
    resetEnvCache();
    vi.clearAllMocks();
    countRemindersSinceMock.mockResolvedValue(0);
    insertReminderMock.mockImplementation(async (input) => {
      const row: ReminderRow = {
        id: input.id,
        invoiceId: input.invoiceId,
        subject: input.subject,
        note: input.note,
        sentAt: input.sentAt ?? now,
      };
      return row;
    });
    generateTextMock.mockResolvedValue({
      text: "SUBJECT: Friendly overdue note\nNOTE: Hi Northwind LLC, $750.00 is still open.",
      content: [],
    } as never);
  });

  afterEach(() => {
    resetEnvCache();
  });

  it("sends a PayPal remind after composing copy", async () => {
    getInvoiceViewMock.mockResolvedValue(overdueView());

    const result = await sendOverdueReminder("inv-overdue", { actor: "user", now });

    expect(result.copySource).toBe("model");
    expect(result.subject).toBe("Friendly overdue note");
    expect(remindInvoiceMock).toHaveBeenCalledTimes(1);
    const sent = remindInvoiceMock.mock.calls[0]?.[0];
    expect(sent?.paypalInvoiceId).toBe("INV2-TEST");
    expect(sent?.reminderId).toBe(result.reminder.id);
    expect(sent?.note).toContain("Northwind LLC");
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "user", action: "remind_invoice" }),
    );
  });

  it("falls back to a template when the model returns empty text", async () => {
    getInvoiceViewMock.mockResolvedValue(overdueView());
    generateTextMock.mockResolvedValue({ text: "", content: [] } as never);

    const result = await sendOverdueReminder("inv-overdue", { actor: "agent", now });

    expect(result.copySource).toBe("fallback");
    expect(result.note).toContain("$750.00");
    expect(remindInvoiceMock).toHaveBeenCalledTimes(1);
  });

  it("refuses local overdue invoices and daily cap hits", async () => {
    getInvoiceViewMock.mockResolvedValue(overdueView({ paypalInvoiceId: null }));
    await expect(sendOverdueReminder("inv-overdue", { now })).rejects.toMatchObject({
      code: "no_paypal",
      status: 409,
    } satisfies Partial<RemindError>);
    expect(remindInvoiceMock).not.toHaveBeenCalled();

    getInvoiceViewMock.mockResolvedValue(overdueView());
    countRemindersSinceMock.mockResolvedValue(2);
    await expect(sendOverdueReminder("inv-overdue", { now })).rejects.toMatchObject({
      code: "capped",
      status: 429,
    });
  });
});

describe("runOverdueReminderSweep", () => {
  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    resetEnvCache();
    vi.clearAllMocks();
    countRemindersSinceMock.mockResolvedValue(0);
    insertReminderMock.mockImplementation(async (input) => ({
      id: input.id,
      invoiceId: input.invoiceId,
      subject: input.subject,
      note: input.note,
      sentAt: input.sentAt ?? now,
    }));
    generateTextMock.mockResolvedValue({
      text: "SUBJECT: Sweep reminder\nNOTE: Please pay $750.00.",
      content: [] as { type: string; text?: string }[],
    } as never);
  });

  it("skips local overdue invoices and sends for PayPal-backed ones", async () => {
    const local = overdueView({ id: "local", paypalInvoiceId: null });
    const remote = overdueView({ id: "remote" });
    listInvoiceViewsMock.mockResolvedValue([local, remote]);
    getInvoiceViewMock.mockImplementation(async (id) => (id === "remote" ? remote : local));

    const result = await runOverdueReminderSweep({ actor: "agent", now });

    expect(result.considered).toBe(2);
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0]?.invoiceId).toBe("remote");
    expect(result.skipped).toEqual([{ invoiceId: "local", reason: "no_paypal" }]);
    expect(remindInvoiceMock).toHaveBeenCalledTimes(1);
  });
});
