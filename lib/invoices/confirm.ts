import { randomUUID } from "node:crypto";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { getClientById } from "@/lib/db/repositories/clients";
import { getInvoiceById, updateInvoice } from "@/lib/db/repositories/invoices";
import type { InvoiceRow, LineItem } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { InvoiceTransitionError, transition } from "@/lib/invoices/state";
import { createDraftInvoice, sendInvoiceAsShareLink } from "@/lib/paypal/invoicing";

export class ConfirmError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ConfirmError";
    this.status = status;
    this.code = code;
  }
}

export type ConfirmInvoiceResult = {
  invoiceId: string;
  status: "SENT";
  paypalInvoiceId: string;
  paypalInvoiceNumber: string | null;
  hostedUrl: string;
  amountCents: number;
  currency: string;
  clientName: string;
  clientEmail: string;
  lineItems: LineItem[];
  dueDate: number | null;
  note: string | null;
  originalAmountCents: number | null;
  originalCurrency: string | null;
  fxRate: string | null;
  alreadySent: boolean;
};

function toResult(
  invoice: InvoiceRow,
  client: { name: string; email: string },
  alreadySent: boolean,
): ConfirmInvoiceResult {
  if (invoice.status !== "SENT" || !invoice.paypalInvoiceId || !invoice.hostedUrl) {
    throw new ConfirmError(500, "incomplete", "Invoice is missing PayPal send details.");
  }
  return {
    invoiceId: invoice.id,
    status: "SENT",
    paypalInvoiceId: invoice.paypalInvoiceId,
    paypalInvoiceNumber: invoice.paypalInvoiceNumber,
    hostedUrl: invoice.hostedUrl,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    clientName: client.name,
    clientEmail: client.email,
    lineItems: invoice.lineItems,
    dueDate: invoice.dueDate,
    note: invoice.note,
    originalAmountCents: invoice.originalAmountCents,
    originalCurrency: invoice.originalCurrency,
    fxRate: invoice.fxRate,
    alreadySent,
  };
}

export async function confirmInvoice(invoiceId: string): Promise<ConfirmInvoiceResult> {
  const env = getEnv();
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new ConfirmError(404, "not_found", "Invoice was not found.");
  }

  const client = await getClientById(invoice.clientId);
  if (!client) {
    throw new ConfirmError(404, "client_not_found", "Client for this invoice was not found.");
  }

  if (invoice.status === "SENT" && invoice.hostedUrl && invoice.paypalInvoiceId) {
    return toResult(invoice, client, true);
  }

  try {
    transition(invoice.status, "SENT");
  } catch (error) {
    if (error instanceof InvoiceTransitionError) {
      throw new ConfirmError(
        409,
        "illegal_status",
        `Cannot confirm an invoice in ${invoice.status} status.`,
      );
    }
    throw error;
  }

  const maxCents = Math.round(env.MAX_INVOICE_USD * 100);
  if (invoice.amountCents > maxCents) {
    throw new ConfirmError(
      422,
      "over_limit",
      `Invoice total exceeds the ${env.MAX_INVOICE_USD} USD sandbox cap.`,
    );
  }

  let paypalInvoiceId = invoice.paypalInvoiceId;
  let paypalInvoiceNumber = invoice.paypalInvoiceNumber;
  let working = invoice;

  if (!paypalInvoiceId) {
    const created = await createDraftInvoice({
      localInvoiceId: invoice.id,
      recipientEmail: client.email,
      recipientName: client.name,
      currency: invoice.currency,
      dueDateMs: invoice.dueDate,
      note: invoice.note,
      items: invoice.lineItems,
    });
    paypalInvoiceId = created.id;
    paypalInvoiceNumber = created.detail?.invoice_number ?? null;
    working = await updateInvoice(invoice.id, {
      paypalInvoiceId,
      paypalInvoiceNumber,
    });
  }

  const sent = await sendInvoiceAsShareLink({
    paypalInvoiceId,
    localInvoiceId: invoice.id,
  });
  if (!sent.hostedUrl) {
    throw new ConfirmError(502, "missing_link", "PayPal did not return a payer share link.");
  }

  const now = Date.now();
  const updated = await updateInvoice(working.id, {
    status: "SENT",
    paypalInvoiceId,
    paypalInvoiceNumber,
    hostedUrl: sent.hostedUrl,
    issuedAt: working.issuedAt ?? now,
  });

  await insertAuditLog({
    id: randomUUID(),
    actor: "user",
    action: "confirm_invoice",
    invoiceId: updated.id,
    payload: {
      paypalInvoiceId,
      hostedUrl: sent.hostedUrl,
      amountCents: updated.amountCents,
    },
  });

  return toResult(updated, client, false);
}
