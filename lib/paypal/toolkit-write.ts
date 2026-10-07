import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { centsToAmountString } from "@/lib/money";
import { getEnv } from "@/lib/env";
import type { LineItem } from "@/lib/db/schema";
import { getInvoice, invoiceIdFromHref } from "@/lib/paypal/invoicing";

/**
 * Gaps vs PayPilot REST create/send:
 * - `create_invoice` has no `payment_term.due_date` / NET_10
 * - toolkit calls do not send `PayPal-Request-Id`
 * - `send_invoice` can set `send_to_recipient` (required: default is email the client)
 */
export const TOOLKIT_CONFIRM_GAPS = [
  "payment_term.due_date",
  "payment_term.term_type NET_10",
  "PayPal-Request-Id idempotency",
] as const;

type ToolkitTool = {
  execute?: (args: unknown, options?: unknown) => Promise<unknown>;
};

function splitName(name: string | undefined): { given_name: string; surname: string } {
  const trimmed = (name ?? "Client").trim() || "Client";
  const parts = trimmed.split(/\s+/);
  return {
    given_name: parts[0] ?? "Client",
    surname: parts.slice(1).join(" ") || "Account",
  };
}

function parseToolkitJson(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

function paypalIdFromToolkitCreate(raw: unknown): string | undefined {
  const value = parseToolkitJson(raw);
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.id === "string" && rec.id.length > 0) {
    return rec.id;
  }
  if (typeof rec.href === "string") {
    return invoiceIdFromHref(rec.href);
  }
  if (rec.error) {
    const err = rec.error as Record<string, unknown>;
    const message = typeof err.message === "string" ? err.message : "toolkit create_invoice failed";
    throw new Error(message);
  }
  return undefined;
}

function hostedUrlFromToolkitSend(raw: unknown): string | undefined {
  const value = parseToolkitJson(raw);
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.href === "string" && rec.href.length > 0) {
    return rec.href;
  }
  if (Array.isArray(rec.links)) {
    const payer = rec.links.find(
      (link) =>
        link &&
        typeof link === "object" &&
        "rel" in link &&
        (link as { rel?: string }).rel === "payer-view" &&
        typeof (link as { href?: string }).href === "string",
    ) as { href?: string } | undefined;
    if (payer?.href) {
      return payer.href;
    }
  }
  if (rec.error) {
    const err = rec.error as Record<string, unknown>;
    const message = typeof err.message === "string" ? err.message : "toolkit send_invoice failed";
    throw new Error(message);
  }
  return undefined;
}

async function runToolkitTool(tool: ToolkitTool | undefined, args: unknown): Promise<unknown> {
  if (!tool?.execute) {
    throw new Error("PayPal Agent Toolkit tool is missing execute().");
  }
  return tool.execute(args, { toolCallId: "paypilot-confirm", messages: [] });
}

export function createPaypalWriteToolkit() {
  const env = getEnv();
  return new PayPalAgentToolkit({
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    configuration: {
      actions: {
        invoices: {
          create: true,
          send: true,
        },
      },
      context: { sandbox: env.PAYPAL_MODE !== "live" },
    },
  });
}

export type ToolkitDraftInput = {
  recipientEmail: string;
  recipientName?: string;
  currency?: string;
  note?: string | null;
  items: LineItem[];
};

export async function createDraftViaToolkit(input: ToolkitDraftInput): Promise<{
  id: string;
  invoiceNumber: string | null;
}> {
  const toolkit = createPaypalWriteToolkit();
  const tools = toolkit.getTools() as Record<string, ToolkitTool>;
  const currency = input.currency ?? "USD";
  const recipient = splitName(input.recipientName);
  const raw = await runToolkitTool(tools.create_invoice, {
    currency_code: currency,
    note: input.note ?? undefined,
    primary_recipients: [
      {
        billing_info: {
          name: recipient,
          email_address: input.recipientEmail.trim().toLowerCase(),
        },
      },
    ],
    items: input.items.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: currency,
        value: centsToAmountString(item.unitAmountCents),
      },
    })),
  });
  const id = paypalIdFromToolkitCreate(raw);
  if (!id) {
    throw new Error("PayPal Agent Toolkit create_invoice did not return an invoice id.");
  }
  const fetched = await getInvoice(id);
  return { id, invoiceNumber: fetched.detail?.invoice_number ?? null };
}

export async function sendInvoiceViaToolkit(input: {
  paypalInvoiceId: string;
  sendToRecipient?: boolean;
}): Promise<{ hostedUrl: string }> {
  const toolkit = createPaypalWriteToolkit();
  const tools = toolkit.getTools() as Record<string, ToolkitTool>;
  const raw = await runToolkitTool(tools.send_invoice, {
    invoice_id: input.paypalInvoiceId,
    send_to_recipient: input.sendToRecipient === true,
  });
  const hostedUrl = hostedUrlFromToolkitSend(raw);
  if (hostedUrl) {
    return { hostedUrl };
  }
  const fetched = await getInvoice(input.paypalInvoiceId);
  const payer = fetched.links?.find((link) => link.rel === "payer-view")?.href;
  if (!payer) {
    throw new Error("PayPal Agent Toolkit send_invoice did not return a payer share link.");
  }
  return { hostedUrl: payer };
}

/** True when toolkit create can represent this invoice without dropping due dates. */
export function toolkitCanCreateWithoutDueDate(dueDateMs: number | null | undefined): boolean {
  return dueDateMs == null;
}
