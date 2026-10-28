import { NextResponse } from "next/server";
import { z } from "zod";
import { denyIfAbusive } from "@/lib/access/abuse";
import { getEnv } from "@/lib/env";
import { ConfirmError, confirmInvoice } from "@/lib/invoices/confirm";
import { PayPalError } from "@/lib/paypal/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const confirmBodySchema = z.object({
  invoiceId: z.string().trim().min(1).max(80),
  emailRecipient: z.boolean().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    getEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Environment is invalid." },
      { status: 503 },
    );
  }

  const denied = await denyIfAbusive(req, { paypalWrite: true });
  if (denied) {
    return denied;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = confirmBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invoiceId is required." }, { status: 400 });
  }

  try {
    const result = await confirmInvoice(parsed.data.invoiceId, {
      emailRecipient: parsed.data.emailRecipient === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ConfirmError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof PayPalError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.paypalName,
          debugId: error.debugId,
        },
        { status: 502 },
      );
    }
    console.error("confirm invoice failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not confirm this invoice." }, { status: 500 });
  }
}
