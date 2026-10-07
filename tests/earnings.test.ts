import { describe, expect, it } from "vitest";
import {
  earningsFactsForModel,
  earningsSnapshot,
  monthlySummaryPrompt,
  toEarningsRow,
  utcMonthRange,
} from "@/lib/invoices/earnings";
import type { InvoiceView } from "@/lib/invoices/views";

const now = Date.parse("2026-10-08T12:00:00.000Z");

function view(overrides: Partial<InvoiceView>): InvoiceView {
  return {
    id: "inv",
    paypalInvoiceId: null,
    paypalInvoiceNumber: null,
    clientId: "c1",
    amountCents: 10000,
    currency: "USD",
    status: "SENT",
    dueDate: now + 86_400_000,
    issuedAt: now,
    paidAt: null,
    hostedUrl: null,
    lineItems: [{ name: "Work", quantity: 1, unitAmountCents: 10000 }],
    createdBy: "agent",
    note: null,
    originalAmountCents: null,
    originalCurrency: null,
    fxRate: null,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    clientName: "Acme",
    clientEmail: "acme@example.com",
    displayStatus: "SENT",
    ...overrides,
  };
}

describe("utcMonthRange", () => {
  it("uses UTC month bounds", () => {
    const range = utcMonthRange(now);
    expect(range.monthKey).toBe("2026-10");
    expect(range.monthLabel).toBe("October 2026");
    expect(range.start).toBe(Date.parse("2026-10-01T00:00:00.000Z"));
    expect(range.end).toBe(Date.parse("2026-11-01T00:00:00.000Z"));
  });
});

describe("earningsSnapshot", () => {
  it("splits paid, outstanding, overdue, and drafts", () => {
    const snapshot = earningsSnapshot(
      [
        view({
          id: "paid",
          displayStatus: "PAID",
          status: "PAID",
          amountCents: 48000,
          paidAt: Date.parse("2026-10-05T00:00:00.000Z"),
        }),
        view({
          id: "old-paid",
          displayStatus: "PAID",
          status: "PAID",
          amountCents: 99999,
          paidAt: Date.parse("2026-09-01T00:00:00.000Z"),
        }),
        view({
          id: "sent",
          displayStatus: "SENT",
          status: "SENT",
          amountCents: 120000,
        }),
        view({
          id: "overdue",
          clientName: "Northwind LLC",
          displayStatus: "OVERDUE",
          status: "SENT",
          amountCents: 75000,
          dueDate: Date.parse("2026-09-23T00:00:00.000Z"),
        }),
        view({ id: "draft", displayStatus: "DRAFT", status: "DRAFT", amountCents: 40000 }),
      ],
      now,
    );

    expect(snapshot.paidThisMonthCents).toBe(48000);
    expect(snapshot.paidThisMonthCount).toBe(1);
    expect(snapshot.outstandingCents).toBe(195000);
    expect(snapshot.outstandingCount).toBe(2);
    expect(snapshot.overdueCents).toBe(75000);
    expect(snapshot.overdue[0]?.clientName).toBe("Northwind LLC");
    expect(snapshot.draftCents).toBe(40000);
  });
});

describe("monthly summary prompt", () => {
  it("includes overdue names and does not invent extra invoices", () => {
    const snapshot = earningsSnapshot(
      [
        view({
          id: "overdue",
          clientName: "Northwind LLC",
          displayStatus: "OVERDUE",
          status: "SENT",
          amountCents: 75000,
          dueDate: Date.parse("2026-09-23T00:00:00.000Z"),
        }),
      ],
      now,
    );
    const prompt = monthlySummaryPrompt(snapshot);
    expect(prompt).toContain("Northwind LLC");
    expect(prompt).toContain("$750.00");
    expect(prompt).toContain("Do not invent invoices");
    expect(earningsFactsForModel(snapshot)).toContain("due 2026-09-23");
  });
});

describe("toEarningsRow", () => {
  it("exposes USD major units for the grid number filter", () => {
    const row = toEarningsRow(view({ amountCents: 12050 }));
    expect(row.amountUsd).toBe(120.5);
    expect(row.displayStatus).toBe("SENT");
  });
});
