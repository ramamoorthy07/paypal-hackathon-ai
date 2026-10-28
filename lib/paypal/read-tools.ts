/**
 * PayPal Agent Toolkit read-only tools (list/search invoices in sandbox).
 * Local insight tools for chat live in `@/lib/agent/insight-tools`.
 */
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { getEnv } from "@/lib/core/env";

export const PAYPAL_READ_ACTIONS = {
  invoices: {
    list: true,
    search: true,
  },
} as const;

const WRITE_NAME =
  /create|send|cancel|delete|update|record|remind|generate|activate|pay_|accept|refund/i;

/**
 * True for PayPal Agent Toolkit tools that only list/search/get invoices.
 * Write tools (create, send, remind, cancel, …) stay false even if the toolkit
 * is constructed with a wider allowlist.
 */
export function isPaypalReadToolName(name: string): boolean {
  const lower = name.toLowerCase();
  if (WRITE_NAME.test(lower)) {
    return false;
  }
  return /list_invoices|search_invoicing|get_invoice/.test(lower);
}

export function paypalReadOnlyToolkitConfig(sandbox = true) {
  return {
    actions: PAYPAL_READ_ACTIONS,
    context: { sandbox },
  };
}

export function createPaypalReadOnlyToolkit() {
  const env = getEnv();
  return new PayPalAgentToolkit({
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    configuration: paypalReadOnlyToolkitConfig(env.PAYPAL_MODE !== "live"),
  });
}

export function paypalReadOnlyAgentTools(): Record<string, unknown> {
  try {
    const toolkit = createPaypalReadOnlyToolkit();
    const tools = toolkit.getTools();
    const filtered: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(tools)) {
      if (isPaypalReadToolName(name)) {
        filtered[name] = value;
      }
    }
    return filtered;
  } catch (error) {
    console.error(
      "PayPal Agent Toolkit read tools unavailable",
      error instanceof Error ? error.message : error,
    );
    return {};
  }
}
