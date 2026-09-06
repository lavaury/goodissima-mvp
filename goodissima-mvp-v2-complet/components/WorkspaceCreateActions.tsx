"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function WorkspaceCreateActions({ workspaceId }: { workspaceId: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  function close(focus = false) {
    if (!ref.current?.open) return;
    ref.current.open = false;
    if (focus) ref.current.querySelector("summary")?.focus();
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current?.open) { event.stopPropagation(); close(true); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const query = `?workspaceId=${encodeURIComponent(workspaceId)}`;
  return <details ref={ref} data-workspace-create className="mt-4 w-full rounded-xl border bg-white sm:w-fit">
    <summary className="cursor-pointer rounded-xl px-4 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">+ Nouveau</summary>
    <nav aria-label="Créer dans ce Workspace" className="flex flex-col gap-1 border-t p-2">
      {[{ href: `/gouvernance/nouveau${query}`, label: "Nouveau parcours" }, { href: `/links/simple${query}`, label: "Nouveau lien simple" }].map(item => <Link key={item.href} href={item.href} onClick={() => close()} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{item.label}</Link>)}
    </nav>
  </details>;
}
