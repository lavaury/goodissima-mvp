import Link from "next/link";
import { BoussoleWelcomeDiscovery } from "@/components/BoussoleWelcomeDiscovery";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { requireCurrentUser } from "@/lib/auth";
import { welcomeGeneralContent } from "@/lib/boussole/welcome-content";

export default async function BoussoleWelcomeDiscoveryPage() {
  await requireCurrentUser();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="boussole" />
      <header className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#247f88]">Boussole d’accueil</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">{welcomeGeneralContent.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">{welcomeGeneralContent.reassurance}</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{welcomeGeneralContent.shortDiscovery}</p>
        <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-cyan-200 bg-white px-4 py-2 text-sm font-bold text-cyan-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">
          {welcomeGeneralContent.exitLabels.dashboard}
        </Link>
      </header>

      <BoussoleWelcomeDiscovery />
    </main>
  );
}
