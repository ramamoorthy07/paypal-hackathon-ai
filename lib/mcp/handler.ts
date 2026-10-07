import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { cashForecastPayload, clientRiskPayload, overduePayload } from "@/lib/insights/queries";

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
