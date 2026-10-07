import { NextResponse, type NextRequest } from "next/server";
import { isDemoAccessGranted, isDemoProtectedPath } from "@/lib/access/demo-code";

export function middleware(request: NextRequest): NextResponse {
  if (!isDemoProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (isDemoAccessGranted(request)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    { ok: false, error: "Demo access required. Open /unlock." },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/api/chat/:path*", "/api/invoices/confirm", "/api/invoices/:id/remind"],
};
