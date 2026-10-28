import { randomUUID } from "node:crypto";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { upsertClientByEmail } from "@/lib/db/repositories/clients";
import { getInvoiceByPaypalId, insertInvoice } from "@/lib/db/repositories/invoices";
import type { AuditActor } from "@/lib/db/schema";
import { applyPaypalSnapshot } from "@/lib/invoices/actions/sync";
import { mapPaypalInvoiceStatus } from "@/lib/invoices/state";
import { paypalMajorToCents } from "@/lib/core/money";
import { getInvoice, listAllPaypalInvoices } from "@/lib/paypal/invoicing";
import type { PaypalInvoice } from "@/lib/paypal/schemas";

export type ReconcileSummary = {
  scanned: number;
  updated: number;
  inserted: number;
  skipped: number;
  errors: number;
};

function recipientFromPaypal(paypal: PaypalInvoice): { email: string; name: string } | undefined {
  const billing = paypal.primary_recipients?.[0]?.billing_info;
  const email = billing?.email_address?.trim().toLowerCase();
  if (!billing || !email || !email.includes("@")) {
    return undefined;
  }
  const given = billing.name?.given_name?.trim() ?? "";
  const surname = billing.name?.surname?.trim() ?? "";
  const name = `${given} ${surname}`.trim() || email.split("@")[0] || "Client";
  return { email, name };
}

function dueDateMs(paypal: PaypalInvoice): number | null {
  const due = paypal.detail?.payment_term?.due_date;
  if (!due) {
    return null;
  }
  const parsed = Date.parse(`${due}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

async function insertFromPaypal(
  paypal: PaypalInvoice,
  actor: Extract<AuditActor, "user" | "webhook">,
): Promise<"inserted" | "skipped"> {
  const mapped = mapPaypalInvoiceStatus(paypal.status);
  if (!mapped) {
    return "skipped";
  }
  const recipient = recipientFromPaypal(paypal);
  const amountCents = paypal.amount?.value ? paypalMajorToCents(paypal.amount.value) : null;
  if (!recipient || amountCents == null || amountCents <= 0) {
    return "skipped";
  }

  const client = await upsertClientByEmail({
    id: randomUUID(),
    name: recipient.name,
    email: recipient.email,
    isDemo: false,
  });

  const now = Date.now();
  const invoice = await insertInvoice({
    id: randomUUID(),
    paypalInvoiceId: paypal.id,
    paypalInvoiceNumber: paypal.detail?.invoice_number ?? null,
    clientId: client.id,
    amountCents,
    currency: paypal.amount?.currency_code ?? paypal.detail?.currency_code ?? "USD",
    status: mapped,
    dueDate: dueDateMs(paypal),
    issuedAt: mapped === "DRAFT" ? null : now,
    paidAt: mapped === "PAID" ? now : null,
    hostedUrl: paypal.links?.find((link) => link.rel === "payer-view")?.href ?? null,
    lineItems: [{ name: "PayPal invoice", quantity: 1, unitAmountCents: amountCents }],
    createdBy: "user",
    isDemo: false,
    note: "Imported from PayPal reconcile",
  });

  await insertAuditLog({
    id: randomUUID(),
    actor,
    action: "reconcile_paypal_insert",
    invoiceId: invoice.id,
    payload: {
      paypalInvoiceId: paypal.id,
      status: mapped,
    },
  });

  return "inserted";
}

export async function reconcileInvoicesFromPaypal(input: {
  actor: Extract<AuditActor, "user" | "webhook">;
}): Promise<ReconcileSummary> {
  const listed = await listAllPaypalInvoices();
  const summary: ReconcileSummary = {
    scanned: listed.length,
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
  };

  for (const item of listed) {
    try {
      const local = await getInvoiceByPaypalId(item.id);
      if (local) {
        const result = await applyPaypalSnapshot(local, item, input.actor);
        if (result.applied) {
          summary.updated += 1;
        } else {
          summary.skipped += 1;
        }
        continue;
      }

      const full = await getInvoice(item.id);
      const inserted = await insertFromPaypal(full, input.actor);
      if (inserted === "inserted") {
        summary.inserted += 1;
      } else {
        summary.skipped += 1;
      }
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
}
