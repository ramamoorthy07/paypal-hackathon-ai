import type { InvoiceView } from "@/lib/invoices/views";

const DAY_MS = 86_400_000;

export type RiskBand = "low" | "medium" | "high";

export type ClientBehavior = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  paidCount: number;
  avgDaysToPay: number | null;
  lateRate: number;
  openOverdueCount: number;
  openOverdueCents: number;
  riskScore: number;
  riskBand: RiskBand;
};

/**
 * Deterministic client risk (0–100).
 *
 * - avgDaysToPay: mean (paidAt − issuedAt) in UTC days for PAID invoices that have both timestamps.
 * - A paid invoice is late when paidAt > dueDate. Open OVERDUE invoices also count as late.
 * - lateRate = lateCount / (paidCount + openOverdueCount). 0 when the denominator is 0.
 * - riskScore = clamp(round(55 * lateRate + 2.5 * max(avgDaysLate, 0) + 8 * openOverdueCount), 0, 100)
 *   where avgDaysLate is the mean days past due for late paid invoices (0 if none).
 * - riskBand: low < 35, medium < 70, else high.
 */
export function clientBehaviors(invoices: InvoiceView[], now = Date.now()): ClientBehavior[] {
  const groups = new Map<string, InvoiceView[]>();
  for (const invoice of invoices) {
    const list = groups.get(invoice.clientId) ?? [];
    list.push(invoice);
    groups.set(invoice.clientId, list);
  }

  return [...groups.entries()]
    .map(([clientId, rows]) => behaviorForClient(clientId, rows, now))
    .sort((a, b) => b.riskScore - a.riskScore || a.clientName.localeCompare(b.clientName));
}

export function behaviorForClient(
  clientId: string,
  invoices: InvoiceView[],
  _now = Date.now(),
): ClientBehavior {
  void _now;
  const first = invoices[0];
  const paid = invoices.filter(
    (row) => row.status === "PAID" && row.paidAt != null && row.issuedAt != null,
  );
  const daysToPay = paid.map((row) => (row.paidAt! - row.issuedAt!) / DAY_MS);
  const avgDaysToPay =
    daysToPay.length === 0
      ? null
      : Math.round((daysToPay.reduce((sum, days) => sum + days, 0) / daysToPay.length) * 10) / 10;

  const latePaidDays: number[] = [];
  for (const row of paid) {
    if (row.dueDate != null && row.paidAt! > row.dueDate) {
      latePaidDays.push((row.paidAt! - row.dueDate) / DAY_MS);
    }
  }
  const openOverdue = invoices.filter((row) => row.displayStatus === "OVERDUE");
  const lateCount = latePaidDays.length + openOverdue.length;
  const denom = paid.length + openOverdue.length;
  const lateRate = denom === 0 ? 0 : lateCount / denom;
  const avgDaysLate =
    latePaidDays.length === 0
      ? 0
      : latePaidDays.reduce((sum, days) => sum + days, 0) / latePaidDays.length;

  const riskScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(55 * lateRate + 2.5 * Math.max(avgDaysLate, 0) + 8 * openOverdue.length),
    ),
  );

  return {
    clientId,
    clientName: first?.clientName ?? "Unknown client",
    clientEmail: first?.clientEmail ?? "",
    paidCount: paid.length,
    avgDaysToPay,
    lateRate: Math.round(lateRate * 1000) / 1000,
    openOverdueCount: openOverdue.length,
    openOverdueCents: openOverdue.reduce((sum, row) => sum + row.amountCents, 0),
    riskScore,
    riskBand: riskBandFromScore(riskScore),
  };
}

export function riskBandFromScore(score: number): RiskBand {
  if (score < 35) {
    return "low";
  }
  if (score < 70) {
    return "medium";
  }
  return "high";
}

export function reminderToneFromRisk(
  score: number,
  remindersAlreadyToday: number,
): "friendly" | "firm" | "final" {
  if (remindersAlreadyToday >= 1 || score >= 70) {
    return remindersAlreadyToday >= 1 ? "final" : "firm";
  }
  if (score >= 40) {
    return "firm";
  }
  return "friendly";
}
