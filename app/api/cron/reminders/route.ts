import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { isCronAuthorized } from "@/lib/invoices/cron-auth";
import { runOverdueReminderSweep } from "@/lib/invoices/remind";
import { PayPalError } from "@/lib/paypal/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request): Promise<NextResponse> {
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

export async function GET(request: Request): Promise<NextResponse> {
  return run(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return run(request);
}
