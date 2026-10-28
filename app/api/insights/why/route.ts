import { NextResponse } from "next/server";
import { z } from "zod";
import { denyIfAbusive } from "@/lib/access/abuse";
import { getEnv } from "@/lib/env";
import { insightsSnapshot } from "@/lib/insights/queries";
import { explainClientRisk } from "@/lib/insights/why";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  clientId: z.string().trim().min(1).max(80),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    getEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Environment is invalid." },
      { status: 503 },
    );
  }

  const denied = await denyIfAbusive(request, { requireAccess: false, llm: true });
  if (denied) {
    return denied;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "clientId is required." }, { status: 400 });
  }

  try {
    const snapshot = await insightsSnapshot();
    const behavior = snapshot.behaviors.find((row) => row.clientId === parsed.data.clientId);
    if (!behavior) {
      return NextResponse.json({ ok: false, error: "Client was not found." }, { status: 404 });
    }
    const text = await explainClientRisk(behavior);
    return NextResponse.json({
      ok: true,
      clientId: behavior.clientId,
      riskScore: behavior.riskScore,
      riskBand: behavior.riskBand,
      text,
    });
  } catch (error) {
    console.error("insights why failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not explain this client's risk." }, { status: 502 });
  }
}
