import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Goodissima MVP", description: "Lien sécurisé" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="fr"><body className="min-h-screen text-slate-900">{children}</body></html>; }
