import { z } from "zod";
import { getEnv, paypalApiBase } from "@/lib/env";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const paypalErrorDetailSchema = z.object({
  field: z.string().optional(),
  issue: z.string().optional(),
  description: z.string().optional(),
});

const paypalErrorBodySchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
  debug_id: z.string().optional(),
  details: z.array(paypalErrorDetailSchema).optional(),
});

const invoiceListSchema = z.object({
  total_items: z.number().optional(),
  total_pages: z.number().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        status: z.string().optional(),
      }),
    )
    .optional(),
});

export type PayPalErrorDetail = z.infer<typeof paypalErrorDetailSchema>;

export class PayPalError extends Error {
  readonly paypalName: string;
  readonly status: number;
  readonly details: PayPalErrorDetail[];
  readonly debugId: string | undefined;

  constructor(params: {
    paypalName: string;
    message: string;
    status: number;
    details?: PayPalErrorDetail[];
    debugId?: string;
  }) {
    super(params.message);
    this.name = "PayPalError";
    this.paypalName = params.paypalName;
    this.status = params.status;
    this.details = params.details ?? [];
    this.debugId = params.debugId;
  }
}

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | undefined;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

function userFacingPaypalMessage(paypalName: string, fallback: string): string {
  switch (paypalName) {
    case "AUTHENTICATION_FAILURE":
    case "NOT_AUTHORIZED":
      return "PayPal authentication failed. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.";
    case "INVALID_REQUEST":
      return "PayPal rejected the request. Check invoice fields and try again.";
    case "UNPROCESSABLE_ENTITY":
      return "PayPal could not process this invoice. One or more fields are invalid.";
    case "INSTRUMENT_DECLINED":
      return "The payment method was declined. Try a different sandbox buyer funding source.";
    default:
      return fallback;
  }
}

async function readPaypalError(response: Response): Promise<PayPalError> {
  const text = await response.text();
  const parsed = paypalErrorBodySchema.safeParse(safeJson(text));
  const paypalName = parsed.success
    ? (parsed.data.name ?? `HTTP_${response.status}`)
    : `HTTP_${response.status}`;
  const rawMessage =
    parsed.success && parsed.data.message
      ? parsed.data.message
      : text.slice(0, 200) || response.statusText;
  const details = parsed.success ? (parsed.data.details ?? []) : [];

  return new PayPalError({
    paypalName,
    message: userFacingPaypalMessage(paypalName, rawMessage),
    status: response.status,
    details,
    debugId: parsed.success ? parsed.data.debug_id : undefined,
  });
}

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

function clearTokenCache(): void {
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
    throw new PayPalError({
      paypalName: "INVALID_TOKEN_RESPONSE",
      message: "PayPal token response was missing expected fields.",
      status: response.status,
    });
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

export async function paypalFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const env = getEnv();
  const { idempotencyKey, headers: initHeaders, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();

  const send = async (retried: boolean): Promise<T> => {
    const accessToken = await getAccessToken();
    const headers = new Headers(initHeaders);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");
    if (method !== "GET" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (method === "POST" && idempotencyKey) {
      headers.set("PayPal-Request-Id", idempotencyKey);
    }

    const response = await fetch(`${paypalApiBase(env.PAYPAL_MODE)}${path}`, {
      ...rest,
      method,
      headers,
    });

    if (response.status === 401 && !retried) {
      clearTokenCache();
      return send(true);
    }

    if (!response.ok) {
      throw await readPaypalError(response);
    }

    if (response.status === 204) {
      return schema.parse(undefined);
    }

    const json: unknown = await response.json();
    return schema.parse(json);
  };

  return send(false);
}

export async function pingPaypalInvoices(): Promise<{
  invoiceCount: number;
  sampleStatus: string | undefined;
}> {
  const listed = await paypalFetch(
    "/v2/invoicing/invoices?page=1&page_size=1&total_required=true",
    invoiceListSchema,
    { method: "GET" },
  );

  return {
    invoiceCount: listed.total_items ?? listed.items?.length ?? 0,
    sampleStatus: listed.items?.[0]?.status,
  };
}
