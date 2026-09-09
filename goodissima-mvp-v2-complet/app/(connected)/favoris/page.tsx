import Link from "next/link";
import { ObjectActionRow } from "@/components/ObjectActionRow";
import { listFavorites } from "@/lib/personal-favorites-actions";

export const dynamic = "force-dynamic";

export default async function FavoritesPage({ searchParams }: { searchParams: { page?: string | string[] } }) {
  const result = await listFavorites(searchParams.page);
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-bold">Favoris Goodissima</h1>
    <p className="mt-2 text-sm text-slate-600">Vos raccourcis personnels vers les objets auxquels vous avez accès.</p>
    {!result.items.length ? <p role="status" className="mt-6 rounded-xl border border-dashed p-4">Aucun favori accessible sur cette page. Utilisez le menu ••• d’un objet pour l’ajouter aux favoris.</p> :
      <ul className="mt-6 space-y-3">{result.items.map(item => <ObjectActionRow as="li" key={`${item.objectKind}:${item.objectId}`} name={item.title} href={item.href} favorite={{ objectKind: item.objectKind, objectId: item.objectId }} className="min-w-0 rounded-xl border p-4 pr-16">
        <span className="block text-xs font-semibold text-slate-600">{item.label}</span>
        <Link href={item.href} prefetch={false} className="flex min-h-11 items-center break-words rounded-lg font-medium underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">{item.title}</Link>
      </ObjectActionRow>)}</ul>}
    <nav aria-label="Pages des favoris" className="mt-6 flex flex-wrap gap-3">
      {result.page > 0 && <Link href={`/favoris?page=${result.page - 1}`} className="inline-flex min-h-11 items-center rounded-lg border px-3">Précédent</Link>}
      {result.hasMore && <Link href={`/favoris?page=${result.page + 1}`} className="inline-flex min-h-11 items-center rounded-lg border px-3">Suivant</Link>}
    </nav>
  </main>;
}
