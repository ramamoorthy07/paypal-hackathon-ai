import { z } from "zod";
import { centsToAmountString, isoDateFromMs } from "@/lib/core/money";
import { paypalFetch, paypalRequest } from "@/lib/paypal/client";
import { idempotencyKey, paypalErrorFromHttp } from "@/lib/paypal/errors";
import {
  paypalInvoiceListSchema,
  paypalInvoiceSchema,
  paypalSendLinkSchema,
  type PaypalInvoice,
  type PaypalInvoiceList,
} from "@/lib/paypal/schemas";
import type { LineItem } from "@/lib/db/schema";

export type CreateDraftInvoiceInput = {
  localInvoiceId: string;
  recipientEmail: string;
  recipientName?: string;
  currency?: string;
  dueDateMs?: number | null;
  note?: string | null;
  items: LineItem[];
};

function splitName(name: string | undefined): { given_name: string; surname: string } {
  const trimmed = (name ?? "Client").trim() || "Client";
  const parts = trimmed.split(/\s+/);
  const given_name = parts[0] ?? "Client";
  const surname = parts.slice(1).join(" ") || "Account";
  return { given_name, surname };
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

export function hostedUrlFromInvoice(invoice: PaypalInvoice): string | undefined {
  const payerView = invoice.links?.find((link) => link.rel === "payer-view");
  return payerView?.href;
}

export function invoiceIdFromHref(href: string | null | undefined): string | undefined {
  if (!href) {
    return undefined;
  }
  const match = href.match(/\/v2\/invoicing\/invoices\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function jsonOrUndefined(text: string): unknown {
  if (!text.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function createDraftInvoice(input: CreateDraftInvoiceInput): Promise<PaypalInvoice> {
  const currency = input.currency ?? "USD";
  const recipient = splitName(input.recipientName);
  const items = input.items.map((item) => ({
    name: clip(item.name, 120),
    description: item.description ? clip(item.description, 1000) : undefined,
    quantity: String(item.quantity),
    unit_amount: {
      currency_code: currency,
      value: centsToAmountString(item.unitAmountCents),
    },
  }));

  const body: Record<string, unknown> = {
    detail: {
      currency_code: currency,
      note: input.note ? clip(input.note, 4000) : undefined,
      payment_term: input.dueDateMs
        ? { due_date: isoDateFromMs(input.dueDateMs) }
        : { term_type: "NET_10" },
    },
    primary_recipients: [
      {
        billing_info: {
          name: recipient,
          email_address: input.recipientEmail.trim().toLowerCase(),
        },
      },
    ],
    items,
  };

  const response = await paypalRequest("/v2/invoicing/invoices", {
    method: "POST",
    idempotencyKey: idempotencyKey(input.localInvoiceId, "create"),
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw paypalErrorFromHttp(response.status, jsonOrUndefined(text), text);
  }

  const json = jsonOrUndefined(text);
  const parsed = paypalInvoiceSchema.safeParse(json);
  if (parsed.success) {
    return parsed.data;
  }

  const hrefFromBody =
    json && typeof json === "object" && "href" in json && typeof json.href === "string"
      ? json.href
      : undefined;
  const id = invoiceIdFromHref(response.headers.get("location") ?? hrefFromBody);
  if (id) {
    return getInvoice(id);
  }

  throw paypalErrorFromHttp(response.status, {
    name: "INVALID_RESPONSE",
    message: `PayPal create invoice response did not include an invoice id. location=${response.headers.get("location") ? "yes" : "no"}`,
  });
}

export async function sendInvoiceAsShareLink(input: {
  paypalInvoiceId: string;
  localInvoiceId: string;
  sendToRecipient?: boolean;
}): Promise<{ hostedUrl: string }> {
  const link = await paypalFetch(
    `/v2/invoicing/invoices/${encodeURIComponent(input.paypalInvoiceId)}/send`,
    paypalSendLinkSchema,
    {
      method: "POST",
      idempotencyKey: idempotencyKey(input.localInvoiceId, "send"),
      body: JSON.stringify({
        send_to_recipient: input.sendToRecipient === true,
        send_to_invoicer: false,
      }),
    },
  );

  return { hostedUrl: link.href };
}

export async function getInvoice(paypalInvoiceId: string): Promise<PaypalInvoice> {
  return paypalFetch(
    `/v2/invoicing/invoices/${encodeURIComponent(paypalInvoiceId)}`,
    paypalInvoiceSchema,
    { method: "GET" },
  );
}

export async function remindInvoice(input: {
  paypalInvoiceId: string;
  localInvoiceId: string;
  reminderId: string;
  subject?: string;
  note?: string;
}): Promise<void> {
  await paypalFetch(
    `/v2/invoicing/invoices/${encodeURIComponent(input.paypalInvoiceId)}/remind`,
    z.unknown().optional(),
    {
      method: "POST",
      idempotencyKey: idempotencyKey(input.localInvoiceId, `remind:${input.reminderId}`),
      body: JSON.stringify({
        subject: input.subject ? clip(input.subject, 4000) : undefined,
        note: input.note ? clip(input.note, 4000) : undefined,
        send_to_invoicer: false,
        send_to_recipient: true,
      }),
    },
  );
}

export async function generateInvoiceQr(input: {
  paypalInvoiceId: string;
  localInvoiceId: string;
}): Promise<{ imageBase64: string; contentType: string }> {
  const response = await paypalRequest(
    `/v2/invoicing/invoices/${encodeURIComponent(input.paypalInvoiceId)}/generate-qr-code`,
    {
      method: "POST",
      idempotencyKey: idempotencyKey(input.localInvoiceId, "qr"),
      body: JSON.stringify({ width: 400, height: 400, action: "pay" }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = undefined;
    }
    throw paypalErrorFromHttp(response.status, body, text);
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  if (contentType.includes("application/json")) {
    const json: unknown = await response.json();
    if (typeof json === "string") {
      return { imageBase64: json, contentType: "image/png" };
    }
    if (json && typeof json === "object" && "image" in json && typeof json.image === "string") {
      return { imageBase64: json.image, contentType: "image/png" };
    }
    return { imageBase64: Buffer.from(JSON.stringify(json)).toString("base64"), contentType };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const asText = bytes.toString("utf8").trim();
  const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(asText) && asText.length > 80;
  return {
    imageBase64: looksBase64 ? asText.replace(/\s+/g, "") : bytes.toString("base64"),
    contentType: looksBase64 ? "image/png" : contentType,
  };
}

export async function listPaypalInvoices(page = 1, pageSize = 20): Promise<PaypalInvoiceList> {
  const size = Math.min(100, Math.max(1, pageSize));
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(size),
    total_required: "true",
  });
  return paypalFetch(`/v2/invoicing/invoices?${params.toString()}`, paypalInvoiceListSchema, {
    method: "GET",
  });
}

const LIST_PAGE_SIZE = 100;
const LIST_MAX_PAGES = 10;

/** Pages GET /v2/invoicing/invoices (page_size 1–100). Caps at 1000 invoices. */
export async function listAllPaypalInvoices(): Promise<PaypalInvoice[]> {
  const collected: PaypalInvoice[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= LIST_MAX_PAGES) {
    const listed = await listPaypalInvoices(page, LIST_PAGE_SIZE);
    totalPages = listed.total_pages ?? page;
    for (const item of listed.items ?? []) {
      if (item.id && item.status) {
        collected.push({
          id: item.id,
          status: item.status,
          detail: item.detail,
          amount: item.amount,
          primary_recipients: item.primary_recipients,
          links: item.links,
        });
      }
    }
    if (!listed.items || listed.items.length === 0) {
      break;
    }
    page += 1;
  }

  return collected;
}
