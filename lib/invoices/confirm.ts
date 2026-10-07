import { randomUUID } from "node:crypto";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { getClientById } from "@/lib/db/repositories/clients";
import { getInvoiceById, updateInvoice } from "@/lib/db/repositories/invoices";
import type { InvoiceRow, LineItem } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { InvoiceTransitionError, transition } from "@/lib/invoices/state";
import { createDraftInvoice, sendInvoiceAsShareLink } from "@/lib/paypal/invoicing";
import {
  createDraftViaToolkit,
  sendInvoiceViaToolkit,
  toolkitCanCreateWithoutDueDate,
} from "@/lib/paypal/toolkit-write";

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

async function createPaypalDraftAfterConfirm(input: {
  localInvoiceId: string;
  recipientEmail: string;
  recipientName?: string;
  currency?: string;
  dueDateMs?: number | null;
  note?: string | null;
  items: LineItem[];
}): Promise<{ id: string; invoiceNumber: string | null; via: "toolkit" | "rest" }> {
  if (toolkitCanCreateWithoutDueDate(input.dueDateMs)) {
    try {
      const created = await createDraftViaToolkit({
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        currency: input.currency,
        note: input.note,
        items: input.items,
      });
      return { ...created, via: "toolkit" };
    } catch (error) {
      console.error(
        "PayPal Agent Toolkit create_invoice failed; falling back to REST",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const created = await createDraftInvoice(input);
  return {
    id: created.id,
    invoiceNumber: created.detail?.invoice_number ?? null,
    via: "rest",
  };
}

async function sendPaypalShareLinkAfterConfirm(input: {
  paypalInvoiceId: string;
  localInvoiceId: string;
  sendToRecipient?: boolean;
}): Promise<{ hostedUrl: string; via: "toolkit" | "rest" }> {
  try {
    const sent = await sendInvoiceViaToolkit({
      paypalInvoiceId: input.paypalInvoiceId,
      sendToRecipient: input.sendToRecipient,
    });
    return { ...sent, via: "toolkit" };
  } catch (error) {
    console.error(
      "PayPal Agent Toolkit send_invoice failed; falling back to REST",
      error instanceof Error ? error.message : error,
    );
  }
  const sent = await sendInvoiceAsShareLink(input);
  return { ...sent, via: "rest" };
}

export async function confirmInvoice(
  invoiceId: string,
  options: { emailRecipient?: boolean } = {},
): Promise<ConfirmInvoiceResult> {
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
    const created = await createPaypalDraftAfterConfirm({
      localInvoiceId: invoice.id,
      recipientEmail: client.email,
      recipientName: client.name,
      currency: invoice.currency,
      dueDateMs: invoice.dueDate,
      note: invoice.note,
      items: invoice.lineItems,
    });
    paypalInvoiceId = created.id;
    paypalInvoiceNumber = created.invoiceNumber;
    working = await updateInvoice(invoice.id, {
      paypalInvoiceId,
      paypalInvoiceNumber,
    });
  }

  const sent = await sendPaypalShareLinkAfterConfirm({
    paypalInvoiceId,
    localInvoiceId: invoice.id,
    sendToRecipient: options.emailRecipient === true,
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
      sendVia: sent.via,
    },
  });

  return toResult(updated, client, false);
}
