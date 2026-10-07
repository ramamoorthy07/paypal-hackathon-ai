import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { SyncError, syncInvoiceFromPaypal } from "@/lib/invoices/sync";
import { toInvoiceView } from "@/lib/invoices/views";
import { getClientById } from "@/lib/db/repositories/clients";
import { PayPalError } from "@/lib/paypal/errors";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    getEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "Environment is invalid." }, { status: 503 });
  }

  const { id } = await context.params;

  try {
    const result = await syncInvoiceFromPaypal(id, "user");
    const client = await getClientById(result.invoice.clientId);
    return NextResponse.json({
      ok: true,
      applied: result.applied,
      reason: result.reason ?? null,
      invoice: toInvoiceView(result.invoice, client),
    });
  } catch (error) {
    if (error instanceof SyncError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof PayPalError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.paypalName, debugId: error.debugId },
        { status: 502 },
      );
    }
    console.error("invoice sync failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not refresh invoice status." }, { status: 500 });
  }
}
