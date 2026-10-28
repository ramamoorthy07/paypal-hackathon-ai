import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { runOverdueReminderSweep } from "@/lib/invoices/actions/remind";
import { getEnv } from "@/lib/core/env";
import { PayPalError } from "@/lib/paypal/errors";

export async function handleOverdueCron(request: Request): Promise<NextResponse> {
  try {
    getEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Environment is invalid." },
      { status: 503 },
    );
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runOverdueReminderSweep({ actor: "agent" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PayPalError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.paypalName, debugId: error.debugId },
        { status: 502 },
      );
    }
    console.error("overdue reminder sweep failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not send overdue reminders." }, { status: 500 });
  }
}
