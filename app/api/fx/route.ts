import { NextResponse } from "next/server";
import { denyIfAbusive } from "@/lib/access/abuse";
import { getEnv } from "@/lib/core/env";
import { formatUsdPerInr, getInrUsdQuote } from "@/lib/fx/quote";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    getEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "Environment is invalid." }, { status: 503 });
  }

  const denied = await denyIfAbusive(request, { requireAccess: false });
  if (denied) {
    return denied;
  }

  const quote = await getInrUsdQuote();
  return NextResponse.json({
    ok: true,
    usdPerInr: quote.usdPerInr,
    usdPerInrLabel: formatUsdPerInr(quote.usdPerInr),
    source: quote.source,
    fetchedAt: quote.fetchedAt,
    asOfDate: quote.asOfDate,
  });
}
