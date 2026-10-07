import { NextResponse } from "next/server";
import { denyIfAbusive } from "@/lib/access/abuse";
import {
  DEMO_ACCESS_COOKIE,
  demoCookieOptions,
  getDemoAccessCode,
  timingSafeEqualString,
} from "@/lib/access/demo-code";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const denied = denyIfAbusive(request, { requireAccess: false });
  if (denied) {
    return denied;
  }

  const expected = getDemoAccessCode();
  const form = await request.formData().catch(() => null);
  const submitted = typeof form?.get("code") === "string" ? String(form.get("code")) : "";
  const unlockUrl = new URL("/unlock", request.url);

  if (!expected) {
    unlockUrl.searchParams.set("error", "unset");
    return NextResponse.redirect(unlockUrl, 303);
  }

  if (!timingSafeEqualString(submitted, expected)) {
    unlockUrl.searchParams.set("error", "1");
    return NextResponse.redirect(unlockUrl, 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(DEMO_ACCESS_COOKIE, submitted, demoCookieOptions());
  return response;
}
