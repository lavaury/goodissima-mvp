import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = { title: "Goodissima MVP", description: "Lien securise" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen text-slate-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
