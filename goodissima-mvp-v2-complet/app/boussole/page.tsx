import Link from "next/link";
import { BoussoleTools } from "@/components/BoussoleTools";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { requireCurrentUser } from "@/lib/auth";
import { compassEntries, compassIntroduction } from "@/lib/boussole";

export default async function CompassPage() {
  await requireCurrentUser();
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="boussole" />
      <header className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#247f88]">Boussole Goodissima</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">Comprendre la navigation V1</h1>
        <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-700">{compassIntroduction}</p>
      </header>

      <BoussoleTools />

      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Menus et zones de Goodissima">
        {compassEntries.map((entry) => (
          <article key={entry.title} className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-950">{entry.title}</h2>
              {entry.href ? <Link href={entry.href} className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-900">Ouvrir</Link> : <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Dans son contexte</span>}
            </div>
            <dl className="mt-4 space-y-3 text-sm leading-relaxed">
              <div><dt className="font-bold text-slate-900">À quoi sert cette zone ?</dt><dd className="mt-1 text-slate-600">{entry.purpose}</dd></div>
              <div><dt className="font-bold text-slate-900">Qui l’utilise ?</dt><dd className="mt-1 text-slate-600">{entry.users}</dd></div>
              <div><dt className="font-bold text-slate-900">Ce que vous pouvez faire</dt><dd className="mt-1 text-slate-600">{entry.canDo}</dd></div>
              <div><dt className="font-bold text-slate-900">Ce que Goodissima ne fait pas automatiquement</dt><dd className="mt-1 text-slate-600">{entry.doesNot}</dd></div>
            </dl>
          </article>
        ))}
      </section>
      <footer className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950"><p className="font-bold">Principe V1</p><p className="mt-1">Toute publication, invitation, autorisation, communication, réunion ou décision reste une action humaine explicite.</p></footer>
    </main>
  );
}
