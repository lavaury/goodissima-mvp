import en from "@/locales/en/common.json";
import fr from "@/locales/fr/common.json";

export const defaultLocale = "fr";
export const localeCookieName = "goodissima_locale";
export const supportedLocales = ["fr", "en"] as const;

export type Locale = (typeof supportedLocales)[number];
export type Messages = Record<string, string>;

const dictionaries: Record<Locale, Messages> = { fr, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}

export function getMessages(locale: Locale = defaultLocale) {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function interpolate(message: string, params?: Record<string, string | number>) {
  if (!params) return message;

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    message,
  );
}

export function createTranslator(locale: Locale = defaultLocale) {
  const messages = getMessages(locale);
  const fallback = getMessages(defaultLocale);

  return (key: string, params?: Record<string, string | number>) =>
    interpolate(messages[key] ?? fallback[key] ?? key, params);
}
