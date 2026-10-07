import { randomUUID } from "node:crypto";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import {
  getInvoiceById,
  getInvoiceByPaypalId,
  updateInvoice,
  type InvoiceUpdate,
} from "@/lib/db/repositories/invoices";
import type { InvoiceRow } from "@/lib/db/schema";
import {
  applyWebhookStatus,
  mapPaypalInvoiceStatus,
  type TransitionFailure,
} from "@/lib/invoices/state";
import { hostedUrlFromInvoice, getInvoice } from "@/lib/paypal/invoicing";
import type { PaypalInvoice } from "@/lib/paypal/schemas";

export class SyncError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SyncError";
    this.status = status;
    this.code = code;
  }
}

export type PaypalSnapshotPatch = {
  patch: InvoiceUpdate;
  applied: boolean;
  reason?: TransitionFailure;
  mappedStatus?: ReturnType<typeof mapPaypalInvoiceStatus>;
};

export function patchFromPaypalInvoice(
  local: InvoiceRow,
  paypal: PaypalInvoice,
  now = Date.now(),
): PaypalSnapshotPatch {
  const patch: InvoiceUpdate = {};
  const hostedUrl = hostedUrlFromInvoice(paypal);
  if (hostedUrl && hostedUrl !== local.hostedUrl) {
    patch.hostedUrl = hostedUrl;
  }
  const number = paypal.detail?.invoice_number;
  if (number && number !== local.paypalInvoiceNumber) {
    patch.paypalInvoiceNumber = number;
  }
  if (!local.paypalInvoiceId && paypal.id) {
    patch.paypalInvoiceId = paypal.id;
  }

  const mappedStatus = mapPaypalInvoiceStatus(paypal.status);
  if (!mappedStatus) {
    return { patch, applied: false, mappedStatus };
  }

  const result = applyWebhookStatus(local.status, mappedStatus);
  if (result.applied) {
    patch.status = result.status;
    if (result.status === "PAID" && local.paidAt == null) {
      patch.paidAt = now;
    }
    if (result.status === "SENT" && local.issuedAt == null) {
      patch.issuedAt = now;
    }
    return { patch, applied: true, mappedStatus };
  }

  return { patch, applied: false, reason: result.reason, mappedStatus };
}

export async function applyPaypalSnapshot(
  local: InvoiceRow,
  paypal: PaypalInvoice,
  actor: "webhook" | "user",
): Promise<{ invoice: InvoiceRow; applied: boolean; reason?: TransitionFailure }> {
  const { patch, applied, reason } = patchFromPaypalInvoice(local, paypal);
  if (Object.keys(patch).length === 0) {
    return { invoice: local, applied: false, reason: reason ?? "noop" };
  }

  const invoice = await updateInvoice(local.id, patch);
  if (applied) {
    await insertAuditLog({
      id: randomUUID(),
      actor,
      action: "sync_paypal_status",
      invoiceId: invoice.id,
      payload: {
        from: local.status,
        to: invoice.status,
        paypalInvoiceId: invoice.paypalInvoiceId,
        paypalStatus: paypal.status,
      },
    });
  }
  return { invoice, applied, reason };
}

export async function syncInvoiceFromPaypal(
  localInvoiceId: string,
  actor: "webhook" | "user" = "user",
): Promise<{ invoice: InvoiceRow; applied: boolean; reason?: TransitionFailure }> {
  const local = await getInvoiceById(localInvoiceId);
  if (!local) {
    throw new SyncError(404, "not_found", "Invoice was not found.");
  }
  if (!local.paypalInvoiceId) {
    throw new SyncError(409, "not_on_paypal", "This invoice has not been sent to PayPal.");
  }

  const paypal = await getInvoice(local.paypalInvoiceId);
  return applyPaypalSnapshot(local, paypal, actor);
}

export async function syncInvoiceByPaypalId(
  paypalInvoiceId: string,
  actor: "webhook" | "user" = "webhook",
): Promise<{ invoice: InvoiceRow; applied: boolean; reason?: TransitionFailure } | undefined> {
  const local = await getInvoiceByPaypalId(paypalInvoiceId);
  if (!local) {
    return undefined;
  }
  const paypal = await getInvoice(paypalInvoiceId);
  return applyPaypalSnapshot(local, paypal, actor);
}
