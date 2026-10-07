import { z } from "zod";
import { getEnv } from "@/lib/env";
import { paypalFetch } from "@/lib/paypal/client";
import { paypalErrorFromHttp } from "@/lib/paypal/errors";

const verifyResponseSchema = z.object({
  verification_status: z.string(),
});

export const paypalWebhookEventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  resource: z.unknown().optional(),
});

export type PaypalWebhookEvent = z.infer<typeof paypalWebhookEventSchema>;

export type PaypalWebhookHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

export function paypalWebhookHeadersFromRequest(req: Request): PaypalWebhookHeaders | null {
  const authAlgo = req.headers.get("paypal-auth-algo")?.trim() ?? "";
  const certUrl = req.headers.get("paypal-cert-url")?.trim() ?? "";
  const transmissionId = req.headers.get("paypal-transmission-id")?.trim() ?? "";
  const transmissionSig = req.headers.get("paypal-transmission-sig")?.trim() ?? "";
  const transmissionTime = req.headers.get("paypal-transmission-time")?.trim() ?? "";
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return null;
  }
  return { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime };
}

export function isPaypalCertUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.toLowerCase().endsWith("paypal.com");
  } catch {
    return false;
  }
}

export function extractPaypalInvoiceId(resource: unknown): string | undefined {
  if (!resource || typeof resource !== "object") {
    return undefined;
  }
  const rec = resource as Record<string, unknown>;
  if (typeof rec.id === "string" && rec.id.startsWith("INV")) {
    return rec.id;
  }
  if (typeof rec.invoice_id === "string" && rec.invoice_id.length > 0) {
    return rec.invoice_id;
  }
  if (rec.invoice && typeof rec.invoice === "object") {
    const invoice = rec.invoice as Record<string, unknown>;
    if (typeof invoice.id === "string" && invoice.id.length > 0) {
      return invoice.id;
    }
  }
  if (typeof rec.id === "string" && rec.id.length > 0) {
    return rec.id;
  }
  return undefined;
}

export async function verifyPaypalWebhookSignature(input: {
  headers: PaypalWebhookHeaders;
  webhookEvent: unknown;
}): Promise<boolean> {
  if (!isPaypalCertUrl(input.headers.certUrl)) {
    throw paypalErrorFromHttp(400, {
      name: "INVALID_CERT_URL",
      message: "PayPal certificate URL is not on paypal.com.",
    });
  }

  const env = getEnv();
  if (!env.PAYPAL_WEBHOOK_ID) {
    throw paypalErrorFromHttp(503, {
      name: "WEBHOOK_NOT_CONFIGURED",
      message: "PAYPAL_WEBHOOK_ID is not set.",
    });
  }

  const result = await paypalFetch(
    "/v1/notifications/verify-webhook-signature",
    verifyResponseSchema,
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: input.headers.authAlgo,
        cert_url: input.headers.certUrl,
        transmission_id: input.headers.transmissionId,
        transmission_sig: input.headers.transmissionSig,
        transmission_time: input.headers.transmissionTime,
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: input.webhookEvent,
      }),
    },
  );

  return result.verification_status.toUpperCase() === "SUCCESS";
}
