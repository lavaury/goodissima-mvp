import Link from "next/link";
import { representationTypeLabels } from "@/components/directory/directory-ui";
import {
  REPRESENTATION_RELATIONSHIP_POLICIES,
  REPRESENTATION_TYPES,
  type PublicDirectoryQuery,
  type PublicRepresentationSummary,
} from "@/lib/directory/contracts";

const publicPolicyLabels = {
  OPEN: "Ouvert aux demandes",
  MESSAGE_ONLY: "Messagerie uniquement",
  CLOSED: "Fermé aux nouvelles demandes",
} as const;

export function GlobalDirectory({ items, query, limitReached }: {
  items: PublicRepresentationSummary[];
  query: PublicDirectoryQuery;
  limitReached: boolean;
}) {
  const filtered = Boolean(query.q || query.type || query.relationshipPolicy || query.territory);

  return (
    <section aria-labelledby="directory-global-title" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global</p>
      <h2 id="directory-global-title" className="mt-1 text-xl font-semibold text-slate-950">Annuaire global</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Seules les représentations publiées, actives et visibles apparaissent ici. Aucune coordonnée personnelle n’est affichée.
      </p>

      <form action="/annuaire" method="get" role="search" className="mt-6 grid gap-4 rounded-xl border bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="tab" value="global" />
        <label className="lg:col-span-2">
          <span className="block text-sm font-semibold text-slate-800">Recherche</span>
          <input name="q" defaultValue={query.q ?? ""} maxLength={100} placeholder="Nom, rôle, organisation…" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="block text-sm font-semibold text-slate-800">Type</span>
          <select name="type" defaultValue={query.type ?? ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm">
            <option value="">Tous</option>
            {REPRESENTATION_TYPES.map((type) => <option key={type} value={type}>{representationTypeLabels[type]}</option>)}
          </select>
        </label>
        <label>
          <span className="block text-sm font-semibold text-slate-800">Politique relationnelle</span>
          <select name="policy" defaultValue={query.relationshipPolicy ?? ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm">
            <option value="">Toutes</option>
            {REPRESENTATION_RELATIONSHIP_POLICIES.map((policy) => <option key={policy} value={policy}>{publicPolicyLabels[policy]}</option>)}
          </select>
        </label>
        <label className="lg:col-span-2">
          <span className="block text-sm font-semibold text-slate-800">Territoire</span>
          <input name="territory" defaultValue={query.territory ?? ""} maxLength={120} placeholder="Ville ou région" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
        </label>
        <div className="flex flex-wrap items-end gap-3 lg:col-span-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Rechercher</button>
          <Link href="/annuaire?tab=global" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-800">Réinitialiser</Link>
        </div>
      </form>

      <p role="status" aria-live="polite" tabIndex={-1} autoFocus={filtered} className="mt-5 text-sm font-semibold text-slate-700 outline-none">
        {items.length} {items.length > 1 ? "résultats affichés" : "résultat affiché"}
      </p>
      {limitReached ? <p className="mt-2 text-sm text-amber-900">Seuls les 50 premiers résultats sont affichés. Affinez votre recherche pour voir d’autres représentations.</p> : null}

      {items.length ? (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {items.map((representation) => (
            <li key={representation.id}>
              <article className="h-full rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{representationTypeLabels[representation.type]}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{representation.displayName}</h3>
                <dl className="mt-3 space-y-2 text-sm text-slate-700">
                  {representation.title ? <div><dt className="sr-only">Titre</dt><dd>{representation.title}</dd></div> : null}
                  {representation.organizationName ? <div><dt className="sr-only">Organisation</dt><dd>{representation.organizationName}</dd></div> : null}
                  {representation.territory ? <div><dt className="sr-only">Territoire</dt><dd>Territoire : {representation.territory}</dd></div> : null}
                  {representation.description ? <div><dt className="sr-only">Description</dt><dd className="whitespace-pre-wrap leading-6">{representation.description}</dd></div> : null}
                  <div><dt className="font-semibold text-slate-900">Politique relationnelle</dt><dd>{publicPolicyLabels[representation.relationshipPolicy]}</dd></div>
                </dl>
                <p className="mt-4 text-xs text-slate-500">Les demandes de contact seront activées dans un prochain lot.</p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-slate-700">
          {filtered ? "Aucune représentation ne correspond à votre recherche." : "Aucune représentation n’est actuellement visible dans l’Annuaire."}
        </p>
      )}
    </section>
  );
}
