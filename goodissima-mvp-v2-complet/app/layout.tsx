import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FeedbackButton } from "@/components/FeedbackButton";
import { GlobalLanguageSwitcher } from "@/components/GlobalLanguageSwitcher";
import { I18nProvider } from "@/components/I18nProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Goodissima MVP", description: "Lien securise" };

export default function RootLayout({ children }: { children: ReactNode }) {
  const { locale, messages } = getI18n();

  return (
    <html lang={locale}>
      <body className="min-h-screen text-slate-900">
        <I18nProvider initialLocale={locale} initialMessages={messages}>
          <ToastProvider>
            {children}
            <GlobalLanguageSwitcher />
            <FeedbackButton />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
