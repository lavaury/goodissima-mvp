import Link from "next/link";

type RelatedLink = { title: string; href: string; status: string };
type RelatedCase = { candidateName: string; href: string };

export function HistoricalTemplateCompatibilityView({ title, description, ambiguous, links, cases }: {
  title: string;
  description: string | null;
  ambiguous: boolean;
  links: RelatedLink[];
  cases: RelatedCase[];
}) {
  const label = ambiguous ? "Objet historique à vérifier" : "Opportunité historique";
  return <main className="mx-auto min-w-0 max-w-4xl px-4 py-8 sm:px-6">
    <Link href="/gouvernance" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 underline underline-offset-4">Retour à Mes espaces</Link>
    <header className="mt-4 rounded-2xl border bg-white p-5 sm:p-7">
      <p className="text-sm font-semibold text-cyan-800">{label}</p>
      <h1 className="mt-2 break-words text-3xl font-bold text-slate-950">{title}</h1>
      {description ? <p className="mt-3 whitespace-pre-wrap break-words text-slate-700">{description}</p> : <p className="mt-3 text-slate-500">Description non disponible.</p>}
      {ambiguous ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Les informations conservées ne permettent pas de confirmer automatiquement la catégorie de cet objet.</p> : null}
    </header>
    <section className="mt-5 rounded-2xl border bg-white p-5" aria-labelledby="historical-publications">
      <h2 id="historical-publications" className="text-xl font-bold">Publication ou lien associé</h2>
      {links.length ? <ul className="mt-3 space-y-2">{links.map((item, index) => <li key={`${item.href}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="min-w-0 break-words">{item.title}</span><Link href={item.href} className="inline-flex min-h-11 items-center rounded-lg border bg-white px-3 text-sm font-semibold">Ouvrir</Link></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Aucune publication associée disponible.</p>}
    </section>
    <section className="mt-5 rounded-2xl border bg-white p-5" aria-labelledby="historical-cases">
      <h2 id="historical-cases" className="text-xl font-bold">Réponses et Dossiers</h2>
      {cases.length ? <ul className="mt-3 space-y-2">{cases.map((item, index) => <li key={`${item.href}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="min-w-0 break-words">{item.candidateName || "Candidat non identifié"}</span><Link href={item.href} className="inline-flex min-h-11 items-center rounded-lg border bg-white px-3 text-sm font-semibold">Ouvrir le Dossier</Link></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Aucune réponse associée.</p>}
    </section>
  </main>;
}
