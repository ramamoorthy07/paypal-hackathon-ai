import { NextResponse } from "next/server";
import { denyIfAbusive } from "@/lib/access/abuse";
import { getEnv } from "@/lib/env";
import { RemindError, sendOverdueReminder } from "@/lib/invoices/remind";
import { PayPalError } from "@/lib/paypal/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    getEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "Environment is invalid." }, { status: 503 });
  }

  const denied = await denyIfAbusive(req, { llm: true, paypalWrite: true });
  if (denied) {
    return denied;
  }

  const { id } = await context.params;

  try {
    const body = (await req.json().catch(() => ({}))) as { tone?: string };
    const validTones = ["friendly", "firm", "final"] as const;
    const tone =
      typeof body.tone === "string" && validTones.includes(body.tone as (typeof validTones)[number])
        ? (body.tone as (typeof validTones)[number])
        : undefined;

    const result = await sendOverdueReminder(id, { actor: "user", tone });
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
