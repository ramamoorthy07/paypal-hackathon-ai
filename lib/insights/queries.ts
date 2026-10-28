import { clientBehaviors, type ClientBehavior } from "@/lib/insights/behavior";
import { cashForecast, forecastFacts, type CashForecast } from "@/lib/insights/forecast";
import { centsToAmountString, isoDateFromMs } from "@/lib/core/money";
import { listInvoiceViews, type InvoiceView } from "@/lib/invoices/views";

export type InsightsSnapshot = {
  now: number;
  invoices: InvoiceView[];
  behaviors: ClientBehavior[];
  forecast: CashForecast;
};

export async function insightsSnapshot(now = Date.now()): Promise<InsightsSnapshot> {
  const invoices = await listInvoiceViews(now);
  const behaviors = clientBehaviors(invoices, now);
  const forecast = cashForecast(invoices, now, behaviors);
  return { now, invoices, behaviors, forecast };
}

export async function cashForecastPayload(now = Date.now()) {
  const snapshot = await insightsSnapshot(now);
  return {
    generatedAt: snapshot.forecast.generatedAt,
    weeks: snapshot.forecast.weeks,
    facts: forecastFacts(snapshot.forecast, snapshot.behaviors),
  };
}

export async function clientRiskPayload(clientQuery?: string, now = Date.now()) {
  const snapshot = await insightsSnapshot(now);
  const needle = clientQuery?.trim().toLowerCase();
  const rows = needle
    ? snapshot.behaviors.filter(
        (row) =>
          row.clientName.toLowerCase().includes(needle) ||
          row.clientEmail.toLowerCase().includes(needle) ||
          row.clientId === clientQuery,
      )
    : snapshot.behaviors;
  return {
    clients: rows,
    facts: forecastFacts(snapshot.forecast, rows),
  };
}

export async function overduePayload(now = Date.now()) {
  const snapshot = await insightsSnapshot(now);
  const overdue = snapshot.invoices
    .filter((invoice) => invoice.displayStatus === "OVERDUE")
    .map((invoice) => ({
      invoiceId: invoice.id,
      clientName: invoice.clientName,
      amountCents: invoice.amountCents,
      amountUsd: centsToAmountString(invoice.amountCents),
      dueDate: invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : null,
      paypalInvoiceId: invoice.paypalInvoiceId,
      isDemo: invoice.isDemo,
    }));
  return {
    count: overdue.length,
    totalCents: overdue.reduce((sum, row) => sum + row.amountCents, 0),
    invoices: overdue,
  };
}

export function behaviorForInvoice(
  invoice: InvoiceView,
  behaviors: ClientBehavior[],
): ClientBehavior | undefined {
  return behaviors.find((row) => row.clientId === invoice.clientId);
}
