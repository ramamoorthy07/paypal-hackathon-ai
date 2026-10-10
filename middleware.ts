import { NextResponse } from "next/server";

export function middleware(): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/chat/:path*", "/api/invoices/confirm", "/api/invoices/:id/remind"],
};
