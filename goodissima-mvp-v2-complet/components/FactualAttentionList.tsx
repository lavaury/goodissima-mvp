import Link from "next/link";
import type { FactualAlert } from "@/lib/factual-attention";

export function FactualAttentionList({ items }: { items: FactualAlert[] }) {
  if (!items.length) return <p className="mt-3 text-sm text-slate-600" role="status">Rien ne nécessite actuellement votre attention.</p>;
  return <ul className="mt-3 divide-y rounded-xl border bg-white px-4">{items.map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
      <p className="font-medium">{item.object} — {item.label}</p>
      <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
    </div>
    <Link href={item.href} prefetch={false} aria-label={`Ouvrir le dossier : ${item.label}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Ouvrir</Link>
  </li>)}</ul>;
}
