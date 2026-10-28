import { NextResponse } from "next/server";
import { getEnv } from "@/lib/core/env";
import { reconcileInvoicesFromPaypal } from "@/lib/invoices/actions/reconcile";
import { PayPalError } from "@/lib/paypal/errors";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    getEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "Environment is invalid." }, { status: 503 });
  }

  try {
    const summary = await reconcileInvoicesFromPaypal({ actor: "user" });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    if (error instanceof PayPalError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.paypalName, debugId: error.debugId },
        { status: 502 },
      );
    }
    console.error("paypal reconcile failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not sync invoices from PayPal." }, { status: 500 });
  }
}
