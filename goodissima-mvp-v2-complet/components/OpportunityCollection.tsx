"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type OpportunityCollectionRow = { id: string; title: string; status: "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED" | "ARCHIVED"; type: "NEED" | "OFFER" | null; subject: string | null; location: string | null; href: string };
const filters = [{ value: "ALL", label: "Toutes" }, { value: "DRAFT", label: "Brouillons" }, { value: "ACTIVE", label: "Publiées" }, { value: "DISABLED", label: "Suspendues" }, { value: "EXPIRED", label: "Clôturées" }] as const;
const statusLabels = { DRAFT: "Brouillon", ACTIVE: "Publiée", DISABLED: "Suspendue", EXPIRED: "Clôturée", ARCHIVED: "Archivée" } as const;

export function OpportunityCollection({ rows }: { rows: OpportunityCollectionRow[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("ALL");
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("fr"); return rows.filter((row) => (filter === "ALL" || row.status === filter) && (!normalized || [row.title, row.subject, row.location].some((value) => value?.toLocaleLowerCase("fr").includes(normalized)))); }, [filter, query, rows]);
  return <>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div data-boussole-id="opportunities-filters" className="flex flex-wrap gap-2" aria-label="Filtrer les opportunités">{filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 ${filter === item.value ? "bg-slate-900 text-white" : "border bg-white text-slate-700"}`}>{item.label}</button>)}</div>
      <label className="w-full text-sm font-semibold text-slate-700 sm:max-w-xs">Rechercher<input data-boussole-id="opportunities-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Titre, sujet ou lieu" className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" /></label>
    </div>
    <div data-boussole-id="opportunities-list" className="mt-6">
      {visibleRows.length ? <div className="overflow-hidden rounded-2xl border bg-white">{visibleRows.map((row, index) => <article key={row.id} data-boussole-id={index === 0 ? "opportunity-card" : undefined} className="flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><h2 data-boussole-id={index === 0 ? "opportunity-card-title" : undefined} className="truncate font-semibold text-slate-950">{row.title}</h2><p className="mt-1 truncate text-sm text-slate-600">{row.type === "NEED" ? "Je recherche" : row.type === "OFFER" ? "Je propose" : "Opportunité"}{row.subject ? ` · ${row.subject}` : ""}{row.location ? ` · ${row.location}` : ""}</p></div>
        <div className="flex items-center gap-2"><span data-boussole-id={index === 0 ? "opportunity-card-status" : undefined} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{statusLabels[row.status]}</span><Link data-boussole-id={index === 0 ? "open-opportunity" : undefined} href={row.href} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">Ouvrir</Link><details className="relative"><summary aria-label={`Plus d’actions pour ${row.title}`} className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl border text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">•••</summary><div className="absolute right-0 z-10 mt-1 min-w-36 rounded-xl border bg-white p-1 shadow-lg"><Link href={row.href} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Ouvrir</Link></div></details></div>
      </article>)}</div> : <div className="rounded-2xl border border-dashed bg-white p-8 text-center"><h2 className="font-semibold">Aucune opportunité trouvée</h2><p className="mt-2 text-sm text-slate-500">Modifiez le filtre ou la recherche.</p></div>}
    </div>
  </>;
}
