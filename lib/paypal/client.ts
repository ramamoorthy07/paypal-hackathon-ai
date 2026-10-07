import { z } from "zod";
import { getEnv, paypalApiBase } from "@/lib/env";
import { paypalErrorFromHttp, type PayPalError } from "@/lib/paypal/errors";
import { paypalInvoiceListSchema } from "@/lib/paypal/schemas";

export { PayPalError } from "@/lib/paypal/errors";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: z.number().int().positive(),
});

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | undefined;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

function safeJson(text: string): unknown {
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function readPaypalError(response: Response): Promise<PayPalError> {
  const text = await response.text();
  return paypalErrorFromHttp(response.status, safeJson(text), text);
}

export function resetPaypalTokenCache(): void {
  cachedToken = undefined;
}

async function fetchAccessToken(): Promise<string> {
  const env = getEnv();
  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await fetch(`${paypalApiBase(env.PAYPAL_MODE)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw await readPaypalError(response);
  }

  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw paypalErrorFromHttp(response.status, { name: "INVALID_TOKEN_RESPONSE" });
  }

  cachedToken = {
    accessToken: parsed.data.access_token,
    expiresAtMs: Date.now() + parsed.data.expires_in * 1000 - TOKEN_EXPIRY_BUFFER_MS,
  };

  return cachedToken.accessToken;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs) {
    return cachedToken.accessToken;
  }

  return fetchAccessToken();
}

export type PaypalRequestInit = RequestInit & {
  idempotencyKey?: string;
};

export async function paypalRequest(
  path: string,
  init: PaypalRequestInit = {},
): Promise<Response> {
  const env = getEnv();
  const { idempotencyKey, headers: initHeaders, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();

  const send = async (retried: boolean): Promise<Response> => {
    const accessToken = await getAccessToken();
    const headers = new Headers(initHeaders);
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }
    if (method !== "GET" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if ((method === "POST" || method === "PUT" || method === "PATCH") && idempotencyKey) {
      headers.set("PayPal-Request-Id", idempotencyKey);
    }

    const response = await fetch(`${paypalApiBase(env.PAYPAL_MODE)}${path}`, {
      ...rest,
      method,
      headers,
    });

    if (response.status === 401 && !retried) {
      resetPaypalTokenCache();
      return send(true);
    }

    return response;
  };

  return send(false);
}

export async function paypalFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init: PaypalRequestInit = {},
): Promise<T> {
  const response = await paypalRequest(path, init);

  if (!response.ok) {
    throw await readPaypalError(response);
  }

  const text = await response.text();
  if (response.status === 204 || text.trim().length === 0) {
    return schema.parse(undefined);
  }

  return schema.parse(JSON.parse(text) as unknown);
}

export async function pingPaypalInvoices(): Promise<{
  invoiceCount: number;
  sampleStatus: string | undefined;
}> {
  const listed = await paypalFetch(
    "/v2/invoicing/invoices?page=1&page_size=1&total_required=true",
    paypalInvoiceListSchema,
    { method: "GET" },
  );

  return {
    invoiceCount: listed.total_items ?? listed.items?.length ?? 0,
    sampleStatus: listed.items?.[0]?.status,
  };
}
