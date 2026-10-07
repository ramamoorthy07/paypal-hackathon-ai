import { describe, expect, it } from "vitest";
import { behaviorForClient, clientBehaviors, reminderToneFromRisk } from "@/lib/insights/behavior";
import { cashForecast } from "@/lib/insights/forecast";
import type { InvoiceView } from "@/lib/invoices/views";

const DAY = 86_400_000;
const now = Date.parse("2026-10-08T12:00:00.000Z");

function view(overrides: Partial<InvoiceView>): InvoiceView {
  return {
    id: "inv",
    paypalInvoiceId: null,
    paypalInvoiceNumber: null,
    clientId: "c1",
    amountCents: 10000,
    currency: "USD",
    status: "PAID",
    dueDate: now,
    issuedAt: now - 10 * DAY,
    paidAt: now,
    hostedUrl: null,
    lineItems: [{ name: "Work", quantity: 1, unitAmountCents: 10000 }],
    createdBy: "seed",
    note: null,
    originalAmountCents: null,
    originalCurrency: null,
    fxRate: null,
    isDemo: true,
    createdAt: now,
    updatedAt: now,
    clientName: "Acme",
    clientEmail: "acme@example.com",
    displayStatus: "PAID",
    ...overrides,
  };
}

describe("clientBehaviors", () => {
  it("scores an on-time payer as low risk", () => {
    const paid = view({
      id: "p1",
      status: "PAID",
      displayStatus: "PAID",
      issuedAt: now - 10 * DAY,
      dueDate: now,
      paidAt: now - DAY,
    });
    const result = behaviorForClient("c1", [paid], now);
    expect(result.lateRate).toBe(0);
    expect(result.avgDaysToPay).toBe(9);
    expect(result.riskBand).toBe("low");
    expect(result.riskScore).toBeLessThan(35);
  });

  it("raises risk for late pays and open overdue", () => {
    const late = view({
      id: "late",
      status: "PAID",
      displayStatus: "PAID",
      issuedAt: now - 30 * DAY,
      dueDate: now - 20 * DAY,
      paidAt: now - 5 * DAY,
    });
    const overdue = view({
      id: "od",
      status: "SENT",
      displayStatus: "OVERDUE",
      paidAt: null,
      issuedAt: now - 40 * DAY,
      dueDate: now - 10 * DAY,
      amountCents: 50000,
    });
    const result = behaviorForClient("c1", [late, overdue], now);
    expect(result.lateRate).toBe(1);
    expect(result.openOverdueCount).toBe(1);
    expect(result.riskBand).toBe("high");
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
  });
});

describe("cashForecast", () => {
  it("places outstanding amounts into the due week with low/high bands", () => {
    const sent = view({
      id: "s1",
      status: "SENT",
      displayStatus: "SENT",
      paidAt: null,
      dueDate: now + 2 * DAY,
      amountCents: 20000,
    });
    const forecast = cashForecast([sent], now);
    expect(forecast.weeks).toHaveLength(6);
    const totalExpected = forecast.weeks.reduce((sum, week) => sum + week.expectedCents, 0);
    expect(totalExpected).toBe(20000);
    const filled = forecast.weeks.find((week) => week.expectedCents > 0);
    expect(filled).toBeDefined();
    expect(filled?.lowCents).toBeLessThanOrEqual(filled?.expectedCents ?? 0);
    expect(filled?.highCents).toBeGreaterThanOrEqual(filled?.expectedCents ?? 0);
  });

  it("clamps already-overdue expected cash into the current week", () => {
    const overdue = view({
      id: "old",
      status: "SENT",
      displayStatus: "OVERDUE",
      paidAt: null,
      dueDate: now - 40 * DAY,
      amountCents: 15000,
    });
    const forecast = cashForecast([overdue], now);
    expect(forecast.weeks[0]?.expectedCents).toBe(15000);
  });
});

describe("reminderToneFromRisk", () => {
  it("maps score and prior reminders onto friendly/firm/final", () => {
    expect(reminderToneFromRisk(10, 0)).toBe("friendly");
    expect(reminderToneFromRisk(50, 0)).toBe("firm");
    expect(reminderToneFromRisk(80, 0)).toBe("firm");
    expect(reminderToneFromRisk(50, 1)).toBe("final");
  });
});

describe("clientBehaviors grouping", () => {
  it("returns one row per client", () => {
    const rows = clientBehaviors(
      [
        view({ clientId: "a", clientName: "A", id: "1" }),
        view({ clientId: "a", clientName: "A", id: "2" }),
        view({ clientId: "b", clientName: "B", id: "3", clientEmail: "b@example.com" }),
      ],
      now,
    );
    expect(rows).toHaveLength(2);
  });
});
