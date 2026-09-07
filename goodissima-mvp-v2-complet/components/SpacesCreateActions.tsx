"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function SpacesCreateActions({ portfolioId }: { portfolioId?: string } = {}) {
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
  const items = portfolioId
    ? [{ href: `/gouvernance/workspaces/nouveau?portfolioId=${encodeURIComponent(portfolioId)}`, label: "Workspace", target: "create-workspace" }]
    : [{ href: "/gouvernance/workspaces/nouveau", label: "Workspace", target: "create-workspace" }, { href: "/gouvernance/portfolios/nouveau", label: "Portfolio", target: "create-portfolio" }];
  return <details ref={ref} data-boussole-disclosure="navigation" data-spaces-create className={`${portfolioId ? "" : "mt-4 "}w-full rounded-xl border bg-white sm:w-fit`}>
    <summary className="cursor-pointer rounded-xl px-4 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">+ Nouveau</summary>
    <nav aria-label={portfolioId ? "Créer dans ce Portfolio" : "Créer dans Mes espaces"} className="flex flex-col gap-1 border-t p-2">
      {items.map(item => <Link key={item.href} href={item.href} data-boussole-id={item.target} onClick={() => close()} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{item.label}</Link>)}
    </nav>
  </details>;
}
