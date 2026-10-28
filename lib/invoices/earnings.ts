import { centsToAmountString, isoDateFromMs } from "@/lib/core/money";
import type { ClientBehavior, RiskBand } from "@/lib/insights/behavior";
import type { InvoiceView } from "@/lib/invoices/views";
import type { DisplayStatus } from "@/lib/invoices/state";

export type EarningsRow = {
  id: string;
  clientName: string;
  clientEmail: string;
  amountCents: number;
  amountUsd: number;
  currency: string;
  displayStatus: DisplayStatus;
  dueDate: string;
  paidAt: string;
  createdAt: string;
  dueDateMs: number | null;
  paidAtMs: number | null;
  riskScore: number | null;
  riskBand: RiskBand | null;
};

export type OverdueItem = {
  clientName: string;
  amountCents: number;
  dueDate: string;
};

export type EarningsSnapshot = {
  monthKey: string;
  monthLabel: string;
  paidThisMonthCents: number;
  paidThisMonthCount: number;
  outstandingCents: number;
  outstandingCount: number;
  overdueCents: number;
  overdueCount: number;
  overdue: OverdueItem[];
  draftCents: number;
  draftCount: number;
};

export function utcMonthRange(now = Date.now()): { start: number; end: number; monthKey: string; monthLabel: string } {
  const date = new Date(now);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  const monthKey = isoDateFromMs(start).slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(start));
  return { start, end, monthKey, monthLabel };
}

export function toEarningsRow(
  invoice: InvoiceView,
  behavior?: ClientBehavior,
): EarningsRow {
  return {
    id: invoice.id,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    amountCents: invoice.amountCents,
    amountUsd: invoice.amountCents / 100,
    currency: invoice.currency,
    displayStatus: invoice.displayStatus,
    dueDate: invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "",
    paidAt: invoice.paidAt != null ? isoDateFromMs(invoice.paidAt) : "",
    createdAt: isoDateFromMs(invoice.createdAt),
    dueDateMs: invoice.dueDate,
    paidAtMs: invoice.paidAt,
    riskScore: behavior?.riskScore ?? null,
    riskBand: behavior?.riskBand ?? null,
  };
}

export function earningsSnapshot(invoices: InvoiceView[], now = Date.now()): EarningsSnapshot {
  const { start, end, monthKey, monthLabel } = utcMonthRange(now);
  let paidThisMonthCents = 0;
  let paidThisMonthCount = 0;
  let outstandingCents = 0;
  let outstandingCount = 0;
  let overdueCents = 0;
  let overdueCount = 0;
  let draftCents = 0;
  let draftCount = 0;
  const overdue: OverdueItem[] = [];

  for (const invoice of invoices) {
    if (invoice.displayStatus === "PAID" && invoice.paidAt != null && invoice.paidAt >= start && invoice.paidAt < end) {
      paidThisMonthCents += invoice.amountCents;
      paidThisMonthCount += 1;
    }
    if (invoice.displayStatus === "SENT" || invoice.displayStatus === "OVERDUE") {
      outstandingCents += invoice.amountCents;
      outstandingCount += 1;
    }
    if (invoice.displayStatus === "OVERDUE") {
      overdueCents += invoice.amountCents;
      overdueCount += 1;
      overdue.push({
        clientName: invoice.clientName,
        amountCents: invoice.amountCents,
        dueDate: invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "",
      });
    }
    if (invoice.displayStatus === "DRAFT") {
      draftCents += invoice.amountCents;
      draftCount += 1;
    }
  }

  overdue.sort((a, b) => b.amountCents - a.amountCents);

  return {
    monthKey,
    monthLabel,
    paidThisMonthCents,
    paidThisMonthCount,
    outstandingCents,
    outstandingCount,
    overdueCents,
    overdueCount,
    overdue,
    draftCents,
    draftCount,
  };
}

export function earningsFactsForModel(snapshot: EarningsSnapshot): string {
  const overdueLines =
    snapshot.overdue.length === 0
      ? "None."
      : snapshot.overdue
          .map((item) => `- ${item.clientName}: $${centsToAmountString(item.amountCents)} due ${item.dueDate || "unknown"}`)
          .join("\n");

  return [
    `Month: ${snapshot.monthLabel} (${snapshot.monthKey})`,
    `Paid this month: $${centsToAmountString(snapshot.paidThisMonthCents)} across ${snapshot.paidThisMonthCount} invoice(s)`,
    `Outstanding (sent + overdue): $${centsToAmountString(snapshot.outstandingCents)} across ${snapshot.outstandingCount} invoice(s)`,
    `Overdue: $${centsToAmountString(snapshot.overdueCents)} across ${snapshot.overdueCount} invoice(s)`,
    `Drafts not sent: $${centsToAmountString(snapshot.draftCents)} across ${snapshot.draftCount} invoice(s)`,
    "Overdue invoices:",
    overdueLines,
  ].join("\n");
}

export function monthlySummaryPrompt(snapshot: EarningsSnapshot): string {
  return `You are PayPilot writing a monthly earnings briefing for a freelancer.

Use only these facts. Do not invent invoices, clients, or amounts. Use USD with two decimals. Mention overdue clients by name if any exist. Three short paragraphs max.

${earningsFactsForModel(snapshot)}`;
}
