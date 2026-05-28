"use client";

import { useRouter } from "next/navigation";
import { supportedLocales, type Locale } from "@/lib/i18n-core";
import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  function selectLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    router.refresh();
  }

  return (
    <div
      className={
        compact
          ? "flex shrink-0 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-2 py-2 shadow-lg shadow-slate-900/10"
          : "flex shrink-0 items-center gap-2 rounded-2xl border bg-white px-2 py-2 shadow-sm"
      }
      aria-label={t("language.label")}
    >
      <span className={compact ? "px-2 text-xs font-semibold text-slate-600" : "hidden px-2 text-xs font-medium text-slate-500 sm:inline"}>
        {t("language.label")}
      </span>
      <div className="flex rounded-full bg-slate-100 p-1">
        {supportedLocales.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => selectLocale(item)}
            className={
              locale === item
                ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm"
                : "rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900"
            }
          >
            {t(`language.${item}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
