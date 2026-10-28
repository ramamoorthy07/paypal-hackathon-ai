/**
 * Apply verified PayPal webhook events to local invoice state (idempotent).
 * Signature verification and event parsing stay in `@/lib/paypal/webhooks`.
 */
import { recordWebhookEvent } from "@/lib/db/repositories/webhook-events";
import { syncInvoiceByPaypalId } from "@/lib/invoices/actions/sync";
import {
  extractPaypalInvoiceId,
  paypalWebhookEventSchema,
  type PaypalWebhookEvent,
} from "@/lib/paypal/webhooks";

export type WebhookHandleResult = {
  duplicate: boolean;
  ignored: boolean;
  applied: boolean;
  invoiceId?: string;
  reason?: string;
};

export async function handlePaypalWebhookEvent(raw: unknown): Promise<WebhookHandleResult> {
  const parsed = paypalWebhookEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { duplicate: false, ignored: true, applied: false, reason: "invalid_event" };
  }

  const event: PaypalWebhookEvent = parsed.data;
  const recorded = await recordWebhookEvent(event.id, event.event_type);
  if (!recorded) {
    return { duplicate: true, ignored: false, applied: false };
  }

  const paypalInvoiceId = extractPaypalInvoiceId(event.resource);
  if (!paypalInvoiceId) {
    return { duplicate: false, ignored: true, applied: false, reason: "no_invoice_id" };
  }

  const res =
    event.resource && typeof event.resource === "object"
      ? (event.resource as Record<string, unknown>)
      : undefined;
  const status =
    typeof res?.status === "string"
      ? (res.status as "PAID" | "CANCELLED" | "SENT" | "DRAFT")
      : event.event_type === "INVOICING.INVOICE.PAID"
        ? "PAID"
        : event.event_type === "INVOICING.INVOICE.CANCELLED"
          ? "CANCELLED"
          : event.event_type === "INVOICING.INVOICE.REFUNDED"
            ? "REFUNDED"
            : undefined;

  const snapshotOverride = status ? { id: paypalInvoiceId, status } : undefined;
  const synced = await syncInvoiceByPaypalId(paypalInvoiceId, "webhook", snapshotOverride);
  if (!synced) {
    return { duplicate: false, ignored: true, applied: false, reason: "unknown_invoice" };
  }

  return {
    duplicate: false,
    ignored: false,
    applied: synced.applied,
    invoiceId: synced.invoice.id,
    reason: synced.reason,
  };
}
