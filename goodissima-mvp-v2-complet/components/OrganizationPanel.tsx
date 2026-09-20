"use client";
import { useRef, type ReactNode } from "react";

/** Presentation only: contextual actions reveal the existing specialized form. */
export function OrganizationPanel({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLDetailsElement>(null);
  return <details ref={panel} data-boussole-disclosure="navigation" className="mt-2">
    <summary tabIndex={-1} className="sr-only">Choix du rattachement et confirmation</summary>
    <div className="rounded-xl border bg-slate-50 p-3">
      {children}
      <button type="button" className="mt-2 min-h-11 rounded-lg border px-3 text-sm focus-visible:outline focus-visible:outline-2"
        onClick={() => {
          if (!panel.current) return;
          panel.current.open = false;
          panel.current.closest("[data-object-action-row]")?.querySelector<HTMLButtonElement>("button[aria-haspopup=menu]")?.focus();
        }}>Annuler</button>
    </div>
  </details>;
}
