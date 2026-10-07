import { randomUUID } from "node:crypto";
import { tool } from "ai";
import { evaluateProposal } from "@/lib/agent/propose";
import { getCashForecast, getClientRisk, listOverdue } from "@/lib/agent/read-tools";
import { invoiceProposalSchema } from "@/lib/agent/schema";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { upsertClientByEmail } from "@/lib/db/repositories/clients";
import { insertInvoice } from "@/lib/db/repositories/invoices";
import { getEnv } from "@/lib/env";

export const proposeInvoice = tool({
  description:
    "Save a local DRAFT invoice for the freelancer to review. Does not contact PayPal. Call only when client name, email, and USD amounts in integer cents are known. For INR, call only after the user confirmed the labeled demo rate.",
  inputSchema: invoiceProposalSchema,
  execute: async (input) => {
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
      message:
        "Draft saved locally. Do not tell the user it was sent. They must confirm in the confirmation card before PayPal is contacted.",
    };
  },
});

export const agentTools = {
  proposeInvoice,
  getCashForecast,
  getClientRisk,
  listOverdue,
};

export const AGENT_WRITE_TOOL_NAMES = ["proposeInvoice"] as const;
export const AGENT_READ_TOOL_NAMES = ["getCashForecast", "getClientRisk", "listOverdue"] as const;
