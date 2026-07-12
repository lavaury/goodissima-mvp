import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/cases/:path*", "/links/new", "/login", "/signup", "/annuaire/:path*", "/gouvernance", "/gouvernance/nouveau", "/gouvernance/pilotage/:path*", "/gouvernance/portfolios/:path*", "/gouvernance/parcours/:path*", "/gouvernance/workspaces/:path*"],
};
