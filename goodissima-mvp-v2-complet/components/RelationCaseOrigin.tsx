import Link from "next/link";

export function RelationCaseOrigin({ title, href }: { title: string | null | undefined; href?: string | null }) {
  const originTitle = title?.trim();
  if (!originTitle) return <p className="break-words text-sm text-slate-600">Via un lien partagé</p>;

  return <p className="min-w-0 break-words text-sm text-slate-600">
    Réponse à « {href ? <Link href={href} aria-label={`Ouvrir l’origine : ${originTitle}`} className="relative z-10 -my-2 inline-flex min-h-11 max-w-full items-center break-words font-medium underline-offset-4 hover:text-cyan-800 hover:underline focus-visible:rounded focus-visible:text-cyan-800 focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">{originTitle}</Link> : originTitle} »
  </p>;
}
