import { NextResponse, type NextRequest } from "next/server";
import { isDemoAccessGranted, isExemptPath, publicRequestUrl } from "@/lib/access/demo-code";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Static files and Next internals are excluded by matcher, but check isExemptPath explicitly
  if (isExemptPath(pathname)) {
    return NextResponse.next();
  }

  const access = await isDemoAccessGranted(request);
  if (!access) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Demo access required. Open /unlock." },
        { status: 401 },
      );
    }
    const unlockUrl = publicRequestUrl("/unlock", request);
    if (pathname !== "/") {
      unlockUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(unlockUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

