import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";

export const defaultLocale = "fr";

type Locale = "fr" | "en" | "es" | "de";
type Messages = Record<string, string>;

const dictionaries: Record<Locale, Messages> = { fr, en, es, de };

export function t(key: string, locale: Locale = defaultLocale) {
  return dictionaries[locale]?.[key] ?? dictionaries[defaultLocale][key] ?? key;
}
