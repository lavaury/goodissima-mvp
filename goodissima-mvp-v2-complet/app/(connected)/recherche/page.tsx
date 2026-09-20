import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { searchGoodissima, searchTerm } from "@/lib/goodissima-search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  noStore();
  const owner = await getCurrentPrismaUser();
  const query = searchTerm(searchParams.q);
  const result = await searchGoodissima(owner.id, searchParams.q);
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-bold">Recherche Goodissima</h1>
    <p className="mt-2 text-sm text-slate-600">Retrouvez vos objets accessibles par leur nom ou leur titre. Pour un dossier, utilisez le nom du candidat.</p>
    <p className="mt-2 text-sm text-slate-600">Pour découvrir des personnes, organisations, professionnels, compétences et attributs vérifiables, consultez l’<Link href="/annuaire" className="underline">Annuaire Global</Link>.</p>
    <form action="/recherche" method="get" role="search" aria-label="Recherche Goodissima" className="mt-6">
      <label htmlFor="goodissima-query" className="block text-sm font-semibold">Nom ou titre</label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input key={query} id="goodissima-query" name="q" type="search" required minLength={2} maxLength={80} defaultValue={query} aria-describedby="search-help" className="min-h-11 min-w-0 flex-1 rounded-lg border px-3 focus-visible:outline-cyan-700" />
        <button type="submit" className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">Rechercher</button>
      </div>
      <p id="search-help" className="mt-2 text-xs text-slate-600">Saisissez de 2 à 80 caractères, puis lancez la recherche.</p>
    </form>
    <section aria-label="Résultats de recherche" className="mt-6">
      {!query ? <p role="status">{searchParams.q !== undefined ? "Recherche invalide. Saisissez de 2 à 80 caractères." : "Saisissez un nom ou un titre pour rechercher vos objets accessibles."}</p>
        : <>
          <h2 className="break-words text-lg font-semibold">Résultats pour « {query} »</h2>
          {!result.items.length && <p role="status" className="mt-3">Aucun objet accessible trouvé pour cette recherche.</p>}
          {result.limited && <p className="mt-3 text-sm text-slate-600">La recherche est limitée aux premiers résultats de chaque catégorie. Affinez le nom ou le titre pour en retrouver d’autres.</p>}
          <ul className="mt-3 space-y-2">{result.items.map(item => <li key={item.href}>
            <Link href={item.href} prefetch={false} className="block min-h-11 rounded-xl border p-3 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">
              <span className="block text-xs font-semibold text-slate-600">{item.type}</span>
              <span className="block break-words font-medium">{item.title}</span>
            </Link>
          </li>)}</ul>
        </>}
    </section>
  </main>;
}
