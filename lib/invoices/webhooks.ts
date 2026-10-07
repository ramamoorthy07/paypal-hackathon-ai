import { recordWebhookEvent } from "@/lib/db/repositories/webhook-events";
import { syncInvoiceByPaypalId } from "@/lib/invoices/sync";
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

  const synced = await syncInvoiceByPaypalId(paypalInvoiceId, "webhook");
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
