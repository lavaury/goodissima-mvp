import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { secureTrace, secureTraceEnvironment } from "@/lib/secure-trace";

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
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/secure/:path*", "/dashboard/:path*", "/cases/:path*", "/links/new", "/login", "/signup", "/annuaire/:path*", "/gouvernance", "/gouvernance/nouveau", "/gouvernance/pilotage/:path*", "/gouvernance/portfolios/:path*", "/gouvernance/parcours/:path*", "/gouvernance/workspaces/:path*"],
};
