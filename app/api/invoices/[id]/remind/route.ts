import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { RemindError, sendOverdueReminder } from "@/lib/invoices/remind";
import { PayPalError } from "@/lib/paypal/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const result = await sendOverdueReminder(id, { actor: "user" });
    return NextResponse.json({
      ok: true,
      reminderId: result.reminder.id,
      subject: result.subject,
      note: result.note,
      copySource: result.copySource,
      sentAt: result.reminder.sentAt,
    });
  } catch (error) {
    if (error instanceof RemindError) {
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
    console.error("invoice remind failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not send the PayPal reminder." }, { status: 500 });
  }
}
