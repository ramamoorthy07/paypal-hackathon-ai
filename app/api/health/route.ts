import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { PayPalError, pingPaypalInvoices } from "@/lib/paypal/client";

export const dynamic = "force-dynamic";

type CheckResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; message: string; [key: string]: unknown };

export async function GET(): Promise<NextResponse> {
  let envCheck: CheckResult;
  try {
    const env = getEnv();
    envCheck = {
      ok: true,
      mode: env.PAYPAL_MODE,
      maxInvoiceUsd: env.MAX_INVOICE_USD,
      webhookConfigured: Boolean(env.PAYPAL_WEBHOOK_ID),
    };
  } catch (error) {
    envCheck = {
      ok: false,
      message: error instanceof Error ? error.message : "Environment is invalid.",
    };
  }

  let dbCheck: CheckResult;
  try {
    const ping = pingDb();
    dbCheck = {
      ok: true,
      invoiceCount: ping.invoiceCount,
    };
  } catch (error) {
    dbCheck = {
      ok: false,
      message: error instanceof Error ? error.message : "Database health check failed.",
    };
  }

  let paypalCheck: CheckResult;
  if (!envCheck.ok) {
    paypalCheck = {
      ok: false,
      message: "Skipped PayPal check because environment is invalid.",
    };
  } else {
    try {
      const ping = await pingPaypalInvoices();
      paypalCheck = {
        ok: true,
        invoiceCount: ping.invoiceCount,
        sampleStatus: ping.sampleStatus ?? null,
      };
    } catch (error) {
      paypalCheck = {
        ok: false,
        message:
          error instanceof PayPalError
            ? error.message
            : error instanceof Error
              ? error.message
              : "PayPal health check failed.",
        paypalName: error instanceof PayPalError ? error.paypalName : undefined,
        debugId: error instanceof PayPalError ? error.debugId : undefined,
      };
    }
  }

  const ok = envCheck.ok && dbCheck.ok && paypalCheck.ok;
  return NextResponse.json(
    {
      ok,
      checks: {
        env: envCheck,
        db: dbCheck,
        paypal: paypalCheck,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
