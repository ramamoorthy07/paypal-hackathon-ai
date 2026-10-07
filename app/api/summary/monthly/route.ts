import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { generateMonthlySummary } from "@/lib/invoices/summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<NextResponse> {
  try {
    getEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Environment is invalid." },
      { status: 503 },
    );
  }

  try {
    const summary = await generateMonthlySummary();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("monthly summary failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not generate the monthly summary." }, { status: 502 });
  }
}
