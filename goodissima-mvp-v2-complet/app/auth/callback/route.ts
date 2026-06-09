import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const redirectUrl = new URL("/login", requestUrl.origin);

  if (!code) {
    redirectUrl.searchParams.set("error", "missing_confirmation_code");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.searchParams.set("error", "email_confirmation_failed");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
