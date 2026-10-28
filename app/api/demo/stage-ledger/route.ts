import { NextResponse } from "next/server";
import { isDemoAccessGranted } from "@/lib/access/demo-code";
import { denyIfAbusive } from "@/lib/access/abuse";
import { seedDemoLedger } from "@/lib/db/seed-demo-ledger";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/stage-ledger
 * Idempotent warm ledger for judges (demo rows only).
 * Requires unlock cookie, or Authorization: Bearer $CRON_SECRET.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const denied = await denyIfAbusive(request, { requireAccess: false });
  if (denied) {
    return denied;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const bearerOk =
    Boolean(cronSecret) &&
    typeof auth === "string" &&
    auth === `Bearer ${cronSecret}`;

  if (!bearerOk && !(await isDemoAccessGranted(request))) {
    return NextResponse.json(
      { ok: false, error: "Demo access or CRON_SECRET bearer required." },
      { status: 401 },
    );
  }

  try {
    const result = await seedDemoLedger();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Seed failed.",
      },
      { status: 500 },
    );
  }
}
