import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { saveProposedInvoice } from "@/lib/agent/propose-save";
import { invoiceProposalSchema } from "@/lib/agent/schema";
import { cashForecastPayload, clientRiskPayload, overduePayload } from "@/lib/insights/queries";

export const MCP_TOOL_NAMES = [
  "propose_invoice",
  "listOverdue",
  "getCashForecast",
  "getClientRisk",
] as const;

export const MCP_PAYPAL_WRITE_TOOL_NAMES = [
  "confirmInvoice",
  "create_invoice",
  "send_invoice",
  "send_invoice_reminder",
  "cancel_sent_invoice",
  "record_payment_for_invoice",
] as const;

function jsonText(value: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function createPaypilotMcpHandler() {
  return createMcpHandler(() => {
    const server = new McpServer({
      name: "paypilot",
      version: "0.1.0",
    });

    server.registerTool(
      "propose_invoice",
      {
        description:
          "Save a local DRAFT invoice in PayPilot. Does not contact PayPal and does not send email. The freelancer must Confirm in the PayPilot UI before a sandbox invoice exists. Same sanitization, cap, and FX-confirm rules as chat.",
        inputSchema: invoiceProposalSchema,
      },
      async (input) => jsonText(await saveProposedInvoice(input, "mcp")),
    );

    server.registerTool(
      "listOverdue",
      {
        description:
          "List local OVERDUE invoices (SENT past dueDate) with integer-cent amounts. Read-only. Does not contact PayPal.",
        inputSchema: z.object({}),
      },
      async () => jsonText(await overduePayload()),
    );

    server.registerTool(
      "getCashForecast",
      {
        description:
          "Next 6 UTC weeks of expected cash from SENT/OVERDUE invoices. Totals are computed in code.",
        inputSchema: z.object({}),
      },
      async () => jsonText(await cashForecastPayload()),
    );

    server.registerTool(
      "getClientRisk",
      {
        description:
          "Computed client risk scores (0–100), late rates, and overdue counts. Optional clientName filter.",
        inputSchema: z.object({
          clientName: z.string().max(200).optional(),
        }),
      },
      async ({ clientName }) => jsonText(await clientRiskPayload(clientName)),
    );

    return server;
  });
}
