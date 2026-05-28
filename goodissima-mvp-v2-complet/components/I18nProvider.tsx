"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  defaultLocale,
  interpolate,
  isLocale,
  localeCookieName,
  type Locale,
  type Messages,
} from "@/lib/i18n-core";
import enMessages from "@/locales/en/common.json";
import frMessages from "@/locales/fr/common.json";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const fallbackMessages = frMessages as Messages;
const clientMessages: Record<Locale, Messages> = {
  fr: frMessages as Messages,
  en: enMessages as Messages,
};

export function I18nProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialMessages: Messages;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<Messages>(initialMessages);

  function setLocale(nextLocale: Locale) {
    if (!isLocale(nextLocale)) return;

    setLocaleState(nextLocale);
    setMessages(clientMessages[nextLocale] ?? fallbackMessages);
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

    fetch(`/api/i18n/messages?locale=${nextLocale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.messages && body.locale === nextLocale) {
          setMessages(body.messages);
        }
      })
      .catch(() => {
        setMessages(fallbackMessages);
      });
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => interpolate(messages[key] ?? fallbackMessages[key] ?? key, params),
    }),
    [locale, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    return {
      locale: defaultLocale,
      setLocale: () => undefined,
      t: (key: string, params?: Record<string, string | number>) =>
        interpolate(fallbackMessages[key] ?? key, params),
    };
  }

  return context;
}
