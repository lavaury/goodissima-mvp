import { NextResponse } from "next/server";
import { defaultLocale, getMessages, isLocale } from "@/lib/i18n-core";

export function GET(req: Request) {
  const localeParam = new URL(req.url).searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  return NextResponse.json({ locale, messages: getMessages(locale) });
}
