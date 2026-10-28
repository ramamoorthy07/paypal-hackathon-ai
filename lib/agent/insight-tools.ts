/**
 * Agent-facing insight tools over local DB analytics (cash forecast, risk, overdue).
 * Not PayPal API tools — those live in `@/lib/paypal/read-tools`.
 */
import { tool } from "ai";
import { z } from "zod";
import { cashForecastPayload, clientRiskPayload, overduePayload } from "@/lib/insights/queries";

export const getCashForecast = tool({
  description:
    "Return the next 6 UTC weeks of expected cash from SENT and OVERDUE invoices. Totals are computed in code (integer cents). Cite the returned numbers; never invent cash figures.",
  inputSchema: z.object({}),
  execute: async () => cashForecastPayload(),
});

export const getClientRisk = tool({
  description:
    "Return computed client payment-risk scores (0–100), late rates, and overdue counts. Optional clientName filters by name, email, or id. Arithmetic is already done; do not recalculate.",
  inputSchema: z.object({
    clientName: z
      .string()
      .max(200)
      .optional()
      .describe("Optional client name, email, or id to filter. Omit to list every client."),
  }),
  execute: async ({ clientName }) => clientRiskPayload(clientName),
});

export const listOverdue = tool({
  description:
    "List local OVERDUE invoices (SENT and past dueDate) with integer-cent amounts. Does not contact PayPal and does not send reminders.",
  inputSchema: z.object({}),
  execute: async () => overduePayload(),
});
