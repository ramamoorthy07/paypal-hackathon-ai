import { randomUUID } from "node:crypto";
import { evaluateProposal, type ProposalRejection } from "@/lib/agent/propose";
import type { InvoiceProposal } from "@/lib/agent/schema";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { upsertClientByEmail } from "@/lib/db/repositories/clients";
import { insertInvoice } from "@/lib/db/repositories/invoices";
import type { LineItem } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

export type ProposeSource = "chat" | "mcp";

export type ProposedInvoiceOk = {
  ok: true;
  status: "DRAFT";
  invoiceId: string;
  clientName: string;
  clientEmail: string;
  amountCents: number;
  currency: "USD";
  lineItems: LineItem[];
  dueDate: number | null;
  notes: string | null;
  originalAmountCents: number | null;
  originalCurrency: string | null;
  fxRate: string | null;
  paypalSent: false;
  paypalTouched: false;
  source: ProposeSource;
  message: string;
};

export type ProposeInvoiceResult = ProposedInvoiceOk | ProposalRejection;

const DRAFT_MESSAGE =
  "Draft saved locally. Do not tell the user it was sent. They must confirm in the PayPilot UI before PayPal is contacted.";

/**
 * Local DRAFT only. Never calls PayPal. Shared by chat `proposeInvoice` and MCP `propose_invoice`.
 */
export async function saveProposedInvoice(
  input: InvoiceProposal,
  source: ProposeSource,
): Promise<ProposeInvoiceResult> {
  const env = getEnv();
  const evaluated = evaluateProposal(input, { maxInvoiceUsd: env.MAX_INVOICE_USD });
  if (!evaluated.ok) {
    return evaluated;
  }

  const client = await upsertClientByEmail({
    id: randomUUID(),
    name: evaluated.clientName,
    email: evaluated.clientEmail,
  });

  const invoice = await insertInvoice({
    id: randomUUID(),
    clientId: client.id,
    amountCents: evaluated.amountCents,
    currency: "USD",
    status: "DRAFT",
    dueDate: evaluated.dueDateMs,
    lineItems: evaluated.lineItems,
    createdBy: "agent",
    note: evaluated.note,
    originalAmountCents: evaluated.originalAmountCents,
    originalCurrency: evaluated.originalCurrency,
    fxRate: evaluated.fxRate,
  });

  await insertAuditLog({
    id: randomUUID(),
    actor: "agent",
    action: "propose_invoice",
    invoiceId: invoice.id,
    payload: {
      source,
      clientEmail: client.email,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      status: invoice.status,
      paypalTouched: false,
    },
  });

  return {
    ok: true as const,
    status: "DRAFT" as const,
    invoiceId: invoice.id,
    clientName: evaluated.clientName,
    clientEmail: client.email,
    amountCents: invoice.amountCents,
    currency: "USD" as const,
    lineItems: evaluated.lineItems,
    dueDate: evaluated.dueDateMs,
    notes: evaluated.note,
    originalAmountCents: evaluated.originalAmountCents,
    originalCurrency: evaluated.originalCurrency,
    fxRate: evaluated.fxRate,
    paypalSent: false,
    paypalTouched: false,
    source,
    message: DRAFT_MESSAGE,
  };
}
