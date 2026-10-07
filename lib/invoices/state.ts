import type { InvoiceRow, InvoiceStatus } from "@/lib/db/schema";

export type DisplayStatus = InvoiceStatus | "OVERDUE";

export type TransitionFailure = "noop" | "stale" | "illegal";

export type TransitionResult =
  | { applied: true; status: InvoiceStatus }
  | { applied: false; reason: TransitionFailure };

const ALLOWED: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export class InvoiceTransitionError extends Error {
  readonly from: InvoiceStatus;
  readonly to: InvoiceStatus;

  constructor(from: InvoiceStatus, to: InvoiceStatus) {
    super(`Cannot change invoice status from ${from} to ${to}.`);
    this.name = "InvoiceTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return value === "DRAFT" || value === "SENT" || value === "PAID" || value === "CANCELLED";
}

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (from === to) {
    return;
  }
  if (!canTransition(from, to)) {
    throw new InvoiceTransitionError(from, to);
  }
}

/**
 * User-facing actions throw on illegal moves.
 * Same-status is allowed (idempotent confirm/send).
 */
export function transition(from: InvoiceStatus, to: InvoiceStatus): InvoiceStatus {
  assertTransition(from, to);
  return to;
}

/**
 * Webhooks must never crash on out-of-order events.
 * - same status: noop
 * - legal next status: apply
 * - move toward an earlier state (e.g. PAID then SENT): stale, ignore
 * - anything else: illegal, ignore
 */
export function applyWebhookStatus(from: InvoiceStatus, to: InvoiceStatus): TransitionResult {
  if (from === to) {
    return { applied: false, reason: "noop" };
  }
  if (canTransition(from, to)) {
    return { applied: true, status: to };
  }
  if (isEarlierOrEqual(to, from)) {
    return { applied: false, reason: "stale" };
  }
  return { applied: false, reason: "illegal" };
}

const RANK: Record<InvoiceStatus, number> = {
  DRAFT: 0,
  SENT: 1,
  PAID: 2,
  CANCELLED: 2,
};

function isEarlierOrEqual(candidate: InvoiceStatus, current: InvoiceStatus): boolean {
  return RANK[candidate] <= RANK[current];
}

export function mapPaypalInvoiceStatus(paypalStatus: string): InvoiceStatus | undefined {
  switch (paypalStatus.toUpperCase()) {
    case "DRAFT":
      return "DRAFT";
    case "SENT":
    case "SCHEDULED":
    case "UNPAID":
    case "PAYMENT_PENDING":
    case "PARTIALLY_PAID":
      return "SENT";
    case "PAID":
    case "MARKED_AS_PAID":
      return "PAID";
    case "CANCELLED":
    case "MARKED_AS_CANCELLED":
      return "CANCELLED";
    default:
      return undefined;
  }
}

export function displayStatus(invoice: Pick<InvoiceRow, "status" | "dueDate">, now = Date.now()): DisplayStatus {
  if (invoice.status === "SENT" && invoice.dueDate != null && invoice.dueDate < now) {
    return "OVERDUE";
  }
  return invoice.status;
}
