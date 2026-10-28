import { NextResponse } from "next/server";
import { getEnv } from "@/lib/core/env";
import { handlePaypalWebhookEvent } from "@/lib/invoices/webhook-handlers";
import { PayPalError } from "@/lib/paypal/errors";
import {
  paypalWebhookHeadersFromRequest,
  verifyPaypalWebhookSignature,
} from "@/lib/paypal/webhooks";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let env;
  try {
    env = getEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "Environment is invalid." }, { status: 503 });
  }

  if (!env.PAYPAL_WEBHOOK_ID) {
    return NextResponse.json(
      { ok: false, error: "PAYPAL_WEBHOOK_ID is not configured. Use invoice status poll until it is." },
      { status: 503 },
    );
  }

  const raw = await req.text();
  let event: unknown;
  try {
    event = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const headers = paypalWebhookHeadersFromRequest(req);
  if (!headers) {
    return NextResponse.json({ ok: false, error: "Missing PayPal transmission headers." }, { status: 400 });
  }

  try {
    const verified = await verifyPaypalWebhookSignature({
      headers,
      webhookEvent: event,
    });
    if (!verified) {
      return NextResponse.json({ ok: false, error: "Webhook signature is invalid." }, { status: 400 });
    }

    const result = await handlePaypalWebhookEvent(event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PayPalError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.paypalName },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }
    console.error("paypal webhook failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 });
  }
}
