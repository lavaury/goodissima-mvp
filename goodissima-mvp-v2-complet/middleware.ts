import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { secureTrace, secureTraceEnvironment } from "@/lib/secure-trace";

const PRIVATE_ROBOTS_VALUE = "noindex, nofollow, noarchive";

function withPrivateRobotsHeader(response: NextResponse) {
  response.headers.set("X-Robots-Tag", PRIVATE_ROBOTS_VALUE);
  return response;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/secure/")) {
    const pathname = request.nextUrl.pathname;
    secureTrace("middleware_hit", {
      route: "/secure/:path*",
      pathnameRedacted: "/secure/<redacted>",
      segmentsCount: pathname.split("/").filter(Boolean).length,
      hasEncodedSlash: pathname.toLowerCase().includes("%2f"),
      hasPlus: pathname.includes("+"),
      hasEquals: pathname.includes("="),
      env: secureTraceEnvironment(),
    });
    return withPrivateRobotsHeader(NextResponse.next());
  }
  return withPrivateRobotsHeader(await updateSession(request));
}

export const config = {
  matcher: [
    "/secure/:path*",
    "/dashboard/:path*",
    "/cases/:path*",
    "/links/:path*",
    "/login",
    "/signup",
    "/annuaire/:path*",
    "/boussole/:path*",
    "/gouvernance/:path*",
  ],
};
