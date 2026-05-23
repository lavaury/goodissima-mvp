import { cookies } from "next/headers";
export {
  createTranslator,
  defaultLocale,
  getMessages,
  interpolate,
  isLocale,
  localeCookieName,
  supportedLocales,
  type Locale,
  type Messages,
} from "@/lib/i18n-core";
import { createTranslator, defaultLocale, getMessages, isLocale, localeCookieName, type Locale } from "@/lib/i18n-core";

export function getCurrentLocale() {
  const value = cookies().get(localeCookieName)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export function getI18n() {
  const locale = getCurrentLocale();

  return {
    locale,
    messages: getMessages(locale),
    t: createTranslator(locale),
  };
}

export function t(key: string, locale: Locale = defaultLocale, params?: Record<string, string | number>) {
  return createTranslator(locale)(key, params);
}
