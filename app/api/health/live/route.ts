import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Process liveness for Render. Does not call PayPal or the LLM. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true });
}
