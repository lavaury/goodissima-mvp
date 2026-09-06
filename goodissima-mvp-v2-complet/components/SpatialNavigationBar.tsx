"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createConnectedHistory, noHistory, type HistoryEntry } from "@/lib/connected-history";
import { isConnectedPathname, logicalParent, type BreadcrumbItem } from "@/lib/spatial-navigation";
import { useBreadcrumb } from "@/components/SpatialNavigationContext";

type NativeNavigation = EventTarget & { currentEntry: HistoryEntry | null; entries(): HistoryEntry[] };
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";
const control = `inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 ${focus}`;

function useConnectedHistory() {
  const router = useRouter();
  const [availability, setAvailability] = useState(noHistory);
  const state = useRef({ tracker: createConnectedHistory(), pending: false, native: null as NativeNavigation | null });
  const read = () => {
    const native = state.current.native;
    return native ? state.current.tracker.observe(native.entries(), native.currentEntry, isConnectedPathname(window.location.pathname)) : noHistory;
  };
  useEffect(() => {
    // Feature detection: unknown history is disabled, never guessed from length/referrer.
    const native = (window as Window & { navigation?: NativeNavigation }).navigation;
    if (!native?.entries) return;
    state.current.native = native;
    const update = () => { state.current.pending = false; setAvailability(read()); };
    update();
    native.addEventListener("currententrychange", update);
    return () => { native.removeEventListener("currententrychange", update); state.current.native = null; };
  }, []);
  const traverse = (direction: "back" | "forward") => {
    if (state.current.pending || !read()[direction]) return;
    state.current.pending = true;
    setAvailability(noHistory);
    if (direction === "back") router.back(); else router.forward();
  };
  return { availability, traverse };
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const renderItem = (item: BreadcrumbItem, current: boolean) => current
    ? <span aria-current="page" title={item.label} className="block truncate font-semibold text-slate-900">{item.label}</span>
    : item.href
      ? <Link href={item.href} className={`block truncate rounded underline underline-offset-4 ${focus}`}>{item.label}</Link>
      : <span title={item.label} className="block truncate">{item.label}</span>;
  return <nav aria-label="Fil d’Ariane" className="min-w-0 flex-1 text-xs text-slate-600">
    <ol className="flex min-w-0 items-center gap-2">
      {items.map((item, index) => <li key={index} className={`${index === items.length - 1 ? "order-2 min-w-0 flex-1" : "min-w-0 max-w-[12rem]"} ${index > 0 && index < items.length - 1 ? "hidden md:flex" : "flex"} items-center gap-2`}>
        {index > 0 ? <span aria-hidden="true" className="shrink-0">›</span> : null}
        {renderItem(item, index === items.length - 1)}
      </li>)}
      {items.length > 2 ? <li className="order-1 flex shrink-0 items-center gap-2 md:hidden">
        <span aria-hidden="true">›</span>
        <details ref={disclosure} onKeyDown={event => { if (event.key === "Escape" && disclosure.current) { disclosure.current.open = false; disclosure.current.querySelector("summary")?.focus(); } }}>
          <summary aria-label="Afficher les niveaux intermédiaires" className={`cursor-pointer list-none rounded-lg border px-2 py-1 ${focus}`}>…</summary>
          <ol className="absolute left-4 right-4 z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border bg-white p-3 shadow-lg">
            {items.slice(1, -1).map((ancestor, index) => <li key={index} className="py-2" onClick={() => { if (disclosure.current) disclosure.current.open = false; }}>{renderItem(ancestor, false)}</li>)}
          </ol>
        </details>
      </li> : null}
    </ol>
  </nav>;
}

export function SpatialNavigationBar() {
  const { items, pending } = useBreadcrumb();
  const parent = pending ? null : logicalParent(items);
  const { availability, traverse } = useConnectedHistory();
  return <div aria-label="Navigation spatiale" className="relative mx-auto flex max-w-[92rem] flex-col gap-2 border-b bg-white px-4 py-2 sm:px-6 lg:flex-row lg:items-center lg:gap-4">
    <div role="group" aria-label="Déplacements" className="flex shrink-0 gap-1">
      <button type="button" aria-label="Retour à l’écran précédent" title={availability.back ? "Retour à l’écran précédent" : "Aucun retour connecté connu"} disabled={!availability.back} onClick={() => traverse("back")} className={`${control} min-w-10`}>← <span className="hidden sm:inline">Retour</span></button>
      <button type="button" aria-label="Suivant dans l’historique" title={availability.forward ? "Suivant dans l’historique" : "Aucune entrée suivante connectée connue"} disabled={!availability.forward} onClick={() => traverse("forward")} className={`${control} min-w-10`}>→ <span className="hidden sm:inline">Suivant</span></button>
      {parent?.href ? <Link href={parent.href} aria-label={`Remonter : ${parent.label}`} title={`Remonter : ${parent.label}`} className={`${control} min-w-10`}>↑ <span className="hidden sm:inline">Remonter</span></Link> : <button type="button" aria-label="Remonter au niveau supérieur" title="Aucun parent logique cliquable" disabled className={`${control} min-w-10`}>↑ <span className="hidden sm:inline">Remonter</span></button>}
      <Link href="/dashboard" aria-label="Accueil Goodissima" className={control}>⌂ <span>Accueil</span></Link>
    </div>
    <Breadcrumb items={items} />
  </div>;
}
