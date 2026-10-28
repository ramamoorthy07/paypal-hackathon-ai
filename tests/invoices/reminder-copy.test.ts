import { describe, expect, it } from "vitest";
import {
  daysOverdue,
  fallbackReminderCopy,
  parseReminderCopy,
  reminderCopyPrompt,
  reminderFacts,
  utcDayStart,
} from "@/lib/invoices/actions/reminder-copy";
import { reminderEligibility } from "@/lib/invoices/actions/remind";
import type { InvoiceView } from "@/lib/invoices/views";

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
    createdBy: "agent",
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

describe("utcDayStart", () => {
  it("snaps to UTC midnight", () => {
    expect(utcDayStart(now)).toBe(Date.parse("2026-10-08T00:00:00.000Z"));
  });
});

describe("daysOverdue", () => {
  it("counts whole UTC days and is at least 1", () => {
    expect(daysOverdue(Date.parse("2026-09-23T00:00:00.000Z"), now)).toBe(15);
    expect(daysOverdue(now - 1000, now)).toBe(1);
  });
});

describe("parseReminderCopy", () => {
  it("reads SUBJECT and NOTE and strips tags", () => {
    const parsed = parseReminderCopy(
      "SUBJECT: Payment reminder for Northwind LLC\nNOTE: Hi Northwind LLC, <b>please</b> pay $750.00.\nThank you.",
    );
    expect(parsed?.subject).toBe("Payment reminder for Northwind LLC");
    expect(parsed?.note).toContain("Hi Northwind LLC");
    expect(parsed?.note).not.toContain("<b>");
  });

  it("returns null when the model skips the labels", () => {
    expect(parseReminderCopy("Please pay soon.")).toBeNull();
  });
});

describe("fallback and prompt", () => {
  it("includes overdue facts without the client email", () => {
    const invoice = overdueView();
    const prompt = reminderCopyPrompt(invoice, now);
    expect(prompt).toContain("Northwind LLC");
    expect(prompt).toContain("$750.00");
    expect(prompt).toContain("Landing page");
    expect(prompt).not.toContain("ap@northwind.example");
    expect(reminderFacts(invoice, now)).toContain("Days overdue: 15 day(s)");
    expect(fallbackReminderCopy(invoice).note).toContain("$750.00");
    expect(fallbackReminderCopy(invoice, "firm").subject).toMatch(/Overdue/i);
    expect(fallbackReminderCopy(invoice, "final").subject).toMatch(/Final reminder/i);
    expect(reminderCopyPrompt(invoice, now, "firm")).toContain("Tone: firm");
  });
});

describe("reminderEligibility", () => {
  it("requires overdue PayPal invoices under the daily cap", () => {
    expect(reminderEligibility(overdueView(), 0)).toBeNull();
    expect(reminderEligibility(overdueView(), 2)).toBe("capped");
    expect(reminderEligibility(overdueView({ paypalInvoiceId: null }), 0)).toBe("no_paypal");
    expect(reminderEligibility(overdueView({ displayStatus: "SENT", status: "SENT" }), 0)).toBe(
      "not_overdue",
    );
  });
});
