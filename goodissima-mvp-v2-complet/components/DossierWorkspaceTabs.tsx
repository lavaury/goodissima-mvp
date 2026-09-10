"use client";

import { useEffect, useRef, useState } from "react";

export type DossierWorkspaceTab = "conversation" | "documents" | "requests" | "details";

const tabs: Array<{ id: DossierWorkspaceTab; label: string }> = [
  { id: "conversation", label: "Conversation" },
  { id: "documents", label: "Documents" },
  { id: "requests", label: "Demandes" },
  { id: "details", label: "Détails" },
];

function showWorkspace(tab: DossierWorkspaceTab) {
  document.querySelectorAll<HTMLElement>("[data-dossier-tab-content]").forEach((panel) => {
    panel.hidden = panel.dataset.dossierTabContent !== tab;
  });
}

export function DossierWorkspaceTabs() {
  const [activeTab, setActiveTab] = useState<DossierWorkspaceTab>("conversation");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(tab: DossierWorkspaceTab, focus = false) {
    showWorkspace(tab);
    setActiveTab(tab);
    if (focus) tabRefs.current[tabs.findIndex((item) => item.id === tab)]?.focus();
  }

  useEffect(() => {
    showWorkspace("conversation");
    const revealTarget = (event: Event) => {
      const targetId = (event as CustomEvent<{ targetId?: string }>).detail?.targetId;
      if (!targetId) return;
      const target = document.querySelector<HTMLElement>(`[data-boussole-id="${CSS.escape(targetId)}"]`);
      const panel = target?.closest<HTMLElement>("[data-dossier-tab-content]");
      const tab = panel?.dataset.dossierTabContent as DossierWorkspaceTab | undefined;
      if (tab && tabs.some((item) => item.id === tab)) selectTab(tab);
    };
    window.addEventListener("goodissima:reveal-dossier-target", revealTarget);
    const openSection = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      selectTab("details");
      if (!section) { tabRefs.current[3]?.focus(); return; }
      const disclosure = document.querySelector<HTMLDetailsElement>(`[data-dossier-section="${CSS.escape(section)}"]`);
      if (!disclosure) return;
      document.querySelectorAll<HTMLDetailsElement>("[data-dossier-section][open]").forEach((item) => { if (item !== disclosure) item.open = false; });
      disclosure.open = true;
      disclosure.scrollIntoView({ block: "center" });
      disclosure.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    };
    window.addEventListener("goodissima:open-dossier-section", openSection);
    return () => {
      window.removeEventListener("goodissima:reveal-dossier-target", revealTarget);
      window.removeEventListener("goodissima:open-dossier-section", openSection);
    };
  }, []);

  function moveFocus(currentIndex: number, key: string) {
    let nextIndex = currentIndex;
    if (key === "ArrowRight" || key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
    else if (key === "ArrowLeft" || key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (key === "Home") nextIndex = 0;
    else if (key === "End") nextIndex = tabs.length - 1;
    else return;
    selectTab(tabs[nextIndex].id, true);
  }

  return (
    <nav data-boussole-id="case-relational-navigation" className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border bg-white p-3 sm:flex sm:flex-wrap" aria-label="Espaces du dossier">
      <div role="tablist" aria-label="Espaces de travail du dossier" className="contents sm:flex sm:flex-wrap sm:gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`dossier-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`dossier-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => moveFocus(index, event.key)}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#247f88] ${activeTab === tab.id ? "bg-slate-900 text-white ring-2 ring-slate-900" : "bg-slate-100 text-slate-700"}`}
          >
            {tab.label}{activeTab === tab.id ? <span className="sr-only"> (onglet actif)</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
