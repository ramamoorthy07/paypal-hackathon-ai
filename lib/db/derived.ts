import type { InvoiceRow, InvoiceStatus } from "@/lib/db/schema";

export type DisplayStatus = InvoiceStatus | "OVERDUE";

export function displayStatus(invoice: InvoiceRow, now = Date.now()): DisplayStatus {
  if (invoice.status === "SENT" && invoice.dueDate != null && invoice.dueDate < now) {
    return "OVERDUE";
  }
  return invoice.status;
}
