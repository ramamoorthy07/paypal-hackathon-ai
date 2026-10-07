import { tool } from "ai";
import { saveProposedInvoice } from "@/lib/agent/propose-save";
import { getCashForecast, getClientRisk, listOverdue } from "@/lib/agent/read-tools";
import { invoiceProposalSchema } from "@/lib/agent/schema";

export const proposeInvoice = tool({
  description:
    "Save a local DRAFT invoice for the freelancer to review. Does not contact PayPal. Call only when client name, email, and USD amounts in integer cents are known. For INR, call only after the user confirmed the labeled demo rate.",
  inputSchema: invoiceProposalSchema,
  execute: async (input) => saveProposedInvoice(input, "chat"),
});

export const agentTools = {
  proposeInvoice,
  getCashForecast,
  getClientRisk,
  listOverdue,
};

export const AGENT_WRITE_TOOL_NAMES = ["proposeInvoice"] as const;
export const AGENT_READ_TOOL_NAMES = ["getCashForecast", "getClientRisk", "listOverdue"] as const;
