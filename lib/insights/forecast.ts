import { isoDateFromMs } from "@/lib/core/money";
import type { InvoiceView } from "@/lib/invoices/views";
import { clientBehaviors, type ClientBehavior } from "@/lib/insights/behavior";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export type WeekForecast = {
  weekStart: string;
  weekEnd: string;
  lowCents: number;
  expectedCents: number;
  highCents: number;
};

export type CashForecast = {
  generatedAt: number;
  weeks: WeekForecast[];
};

function utcMonday(ms: number): number {
  const date = new Date(ms);
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset);
}

/**
 * Next 6 UTC weeks of expected cash from SENT/OVERDUE invoices.
 * Expected pay date = dueDate + max(0, round(avgDaysToPay − 10)) using the client's history
 * (net-10 assumption). Low = expected × (1 − 0.45 × lateRate). High = expected × (1 + 0.15 × (1 − lateRate)).
 */
export function cashForecast(
  invoices: InvoiceView[],
  now = Date.now(),
  behaviors = clientBehaviors(invoices, now),
): CashForecast {
  const byClient = new Map(behaviors.map((row) => [row.clientId, row]));
  const start = utcMonday(now);
  const weeks: WeekForecast[] = Array.from({ length: 6 }, (_, index) => {
    const weekStart = start + index * WEEK_MS;
    return {
      weekStart: isoDateFromMs(weekStart),
      weekEnd: isoDateFromMs(weekStart + WEEK_MS - DAY_MS),
      lowCents: 0,
      expectedCents: 0,
      highCents: 0,
    };
  });

  for (const invoice of invoices) {
    if (invoice.displayStatus !== "SENT" && invoice.displayStatus !== "OVERDUE") {
      continue;
    }
    const behavior = byClient.get(invoice.clientId);
    const due = invoice.dueDate ?? now;
    const slipDays =
      behavior?.avgDaysToPay == null ? 0 : Math.max(0, Math.round(behavior.avgDaysToPay - 10));
    const expectedPay = due + slipDays * DAY_MS;
    const rawIndex = Math.floor((expectedPay - start) / WEEK_MS);
    const index = rawIndex < 0 ? 0 : rawIndex;
    if (index >= weeks.length) {
      continue;
    }
    const lateRate = behavior?.lateRate ?? 0;
    const expected = invoice.amountCents;
    const low = Math.round(expected * (1 - 0.45 * lateRate));
    const high = Math.round(expected * (1 + 0.15 * (1 - lateRate)));
    const bucket = weeks[index];
    if (!bucket) {
      continue;
    }
    bucket.expectedCents += expected;
    bucket.lowCents += low;
    bucket.highCents += high;
  }

  return { generatedAt: now, weeks };
}

export function forecastFacts(forecast: CashForecast, behaviors: ClientBehavior[]): string {
  const weekLines = forecast.weeks
    .map(
      (week) =>
        `- ${week.weekStart} to ${week.weekEnd}: low $${(week.lowCents / 100).toFixed(2)} / expected $${(week.expectedCents / 100).toFixed(2)} / high $${(week.highCents / 100).toFixed(2)}`,
    )
    .join("\n");
  const riskLines = behaviors
    .slice(0, 8)
    .map(
      (row) =>
        `- ${row.clientName}: risk ${row.riskScore} (${row.riskBand}), lateRate ${row.lateRate}, avgDaysToPay ${row.avgDaysToPay ?? "n/a"}, overdue ${row.openOverdueCount}`,
    )
    .join("\n");
  return [
    "Weekly expected cash (computed, USD):",
    weekLines,
    "Client risk (computed):",
    riskLines || "None.",
  ].join("\n");
}
