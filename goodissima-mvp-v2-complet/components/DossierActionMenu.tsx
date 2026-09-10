"use client";

import { RelationGovernanceStatus, RelationPriority, RelationStatus } from "@prisma/client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

const statuses = [
  [RelationStatus.NEW, "Nouveau"], [RelationStatus.WAITING_CANDIDATE, "En attente candidat"],
  [RelationStatus.WAITING_OWNER, "En attente propriétaire"], [RelationStatus.REVIEWING, "En révision"],
  [RelationStatus.VALIDATED, "Validé"], [RelationStatus.REJECTED, "Rejeté"],
  [RelationStatus.CLOSED, "Clos"], [RelationStatus.ARCHIVED, "Archivé"],
] as const;
const priorities = [[RelationPriority.NORMAL, "Normale"], [RelationPriority.HIGH, "Prioritaire"], [RelationPriority.URGENT, "Urgente"]] as const;

type GovernanceAction = { status: RelationGovernanceStatus; label: string; title: string; text?: string; cta: string };
function governanceActions(status: RelationGovernanceStatus): GovernanceAction[] {
  if (status === RelationGovernanceStatus.ACTIVE) return [
    { status: RelationGovernanceStatus.SUSPENDED, label: "Suspendre temporairement…", title: "Suspendre temporairement la relation ?", text: "Les nouveaux échanges et actions relationnelles seront interrompus jusqu’à la reprise de la relation.", cta: "Suspendre" },
    { status: RelationGovernanceStatus.CLOSED, label: "Clôturer…", title: "Clôturer la relation ?", text: "Cette action met fin à la relation active. L’historique reste conservé selon les droits existants.", cta: "Clôturer" },
    { status: RelationGovernanceStatus.BLOCKED, label: "Bloquer…", title: "Bloquer la relation ?", text: "Les nouveaux échanges et actions relationnelles seront interrompus.", cta: "Bloquer" },
  ];
  if (status === RelationGovernanceStatus.SUSPENDED) return [
    { status: RelationGovernanceStatus.ACTIVE, label: "Reprendre la relation…", title: "Reprendre la relation ?", cta: "Reprendre" },
    { status: RelationGovernanceStatus.CLOSED, label: "Clôturer…", title: "Clôturer la relation ?", text: "Cette action met fin à la relation active. L’historique reste conservé selon les droits existants.", cta: "Clôturer" },
    { status: RelationGovernanceStatus.BLOCKED, label: "Bloquer…", title: "Bloquer la relation ?", text: "Les nouveaux échanges et actions relationnelles seront interrompus.", cta: "Bloquer" },
  ];
  return [];
}

type View = "root" | "status" | "priority" | "governance";
export function DossierActionMenu({ caseId, status, priority, governanceStatus }: { caseId: string; status: RelationStatus; priority: RelationPriority; governanceStatus: RelationGovernanceStatus }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("root");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [confirm, setConfirm] = useState<GovernanceAction | "archive" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  function place(x: number, y: number) {
    const width = Math.min(288, window.innerWidth - 16);
    setPosition({ top: Math.max(8, Math.min(y, window.innerHeight - 420)), left: Math.max(8, Math.min(x, window.innerWidth - width - 8)) });
  }
  function openFromButton() {
    const rect = trigger.current?.getBoundingClientRect();
    place(rect?.right ?? 8, rect?.bottom ?? 8);
    setView("root"); setOpen(true);
  }
  function close(restore = true) { setOpen(false); setView("root"); if (restore) requestAnimationFrame(() => trigger.current?.focus()); }
  function reveal(section?: string) {
    close(false);
    window.dispatchEvent(new CustomEvent("goodissima:open-dossier-section", { detail: { section } }));
  }
  async function patch(data: Record<string, string>) {
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error();
      toast.success("Dossier mis à jour"); router.refresh(); close(false); setConfirm(null); setReason(""); requestAnimationFrame(() => trigger.current?.focus());
    } catch { toast.error("Erreur lors de l’action"); }
    finally { setPending(false); }
  }

  useEffect(() => {
    const surface = trigger.current?.closest<HTMLElement>("[data-dossier-context-surface]");
    if (!surface) return;
    const context = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true'], a, button, [data-preserve-native-context-menu], [data-conversation-zone], [data-document-zone], #dossier-panel-documents")) return;
      event.preventDefault(); place(event.clientX, event.clientY); setView("root"); setOpen(true);
    };
    surface.addEventListener("contextmenu", context);
    return () => surface.removeEventListener("contextmenu", context);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node) && event.target !== trigger.current) close(false); };
    document.addEventListener("mousedown", dismiss);
    requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus());
    return () => document.removeEventListener("mousedown", dismiss);
  }, [open, view]);

  useEffect(() => {
    if (!confirm) return;
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("button, textarea")?.focus());
  }, [confirm]);

  function keyboard(event: React.KeyboardEvent) {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not(:disabled)") ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault(); items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }
  const itemClass = "flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-slate-100 focus:bg-slate-100 focus:ring-2 focus:ring-cyan-700";
  const actions = governanceActions(governanceStatus);

  return <>
    <button ref={trigger} type="button" aria-label="Actions du dossier" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => open ? close(false) : openFromButton()} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openFromButton(); } }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white text-xl font-bold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"><span aria-hidden="true">•••</span></button>
    {open ? createPortal(<div ref={menu} id={id} role="menu" aria-label="Actions du dossier" style={position} onKeyDown={keyboard} onContextMenu={(event) => event.preventDefault()} className="fixed z-[100] w-72 max-w-[calc(100vw-1rem)] rounded-xl border bg-white p-1 shadow-xl">
      {view !== "root" ? <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={() => setView("root")}>← Retour</button> : null}
      {view === "root" ? <>
        <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={() => setView("status")}>Modifier le statut <span>›</span></button>
        <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={() => setView("priority")}>Modifier la priorité <span>›</span></button>
        {actions.length ? <button role="menuitem" tabIndex={-1} type="button" className={`${itemClass} border-t`} onClick={() => setView("governance")}>Gouvernance de la relation <span>›</span></button> : null}
        <button role="menuitem" tabIndex={-1} type="button" className={`${itemClass} border-t`} onClick={() => reveal("origin")}>Organiser dans un Workspace…</button>
        <button role="menuitem" tabIndex={-1} type="button" className={`${itemClass} border-t`} onClick={() => reveal("origin")}>Voir l’origine</button>
        <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={() => reveal("timeline")}>Voir la chronologie</button>
        <button role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={() => reveal()}>Voir les détails</button>
        {status !== RelationStatus.ARCHIVED ? <button role="menuitem" tabIndex={-1} type="button" className={`${itemClass} border-t text-amber-800`} onClick={() => { close(false); setConfirm("archive"); }}>Archiver le dossier…</button> : null}
      </> : null}
      {view === "status" ? statuses.map(([value, label]) => <button key={value} role="menuitem" tabIndex={-1} type="button" disabled={pending || value === status} className={itemClass} onClick={() => value === RelationStatus.ARCHIVED ? (close(false), setConfirm("archive")) : void patch({ status: value })}>{label}{value === status ? <span>✓</span> : null}</button>) : null}
      {view === "priority" ? priorities.map(([value, label]) => <button key={value} role="menuitem" tabIndex={-1} type="button" disabled={pending || value === priority} className={itemClass} onClick={() => void patch({ priority: value })}>{label}{value === priority ? <span>✓</span> : null}</button>) : null}
      {view === "governance" ? actions.map((action) => <button key={action.status} role="menuitem" tabIndex={-1} type="button" className={itemClass} onClick={() => { close(false); setConfirm(action); }}>{action.label}</button>) : null}
    </div>, document.body) : null}
    {confirm ? createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setConfirm(null); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) { setConfirm(null); trigger.current?.focus(); }
        if (event.key === "Tab") { const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)") ?? []); const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
      }}>
        <h2 id={`${id}-title`} className="text-lg font-bold text-slate-950">{confirm === "archive" ? "Archiver ce dossier ?" : confirm.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{confirm === "archive" ? "Le dossier quittera les vues actives. Son historique existant n’est pas supprimé par cette action." : confirm.text}</p>
        {confirm !== "archive" ? <label className="mt-4 block text-sm font-semibold text-slate-700">Motif facultatif<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2 font-normal" /></label> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={() => { setConfirm(null); trigger.current?.focus(); }} className="min-h-11 rounded-xl border px-4 py-2 font-semibold">Annuler</button><button type="button" disabled={pending} onClick={() => void patch(confirm === "archive" ? { status: RelationStatus.ARCHIVED } : { governanceStatus: confirm.status, governanceReason: reason })} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Mise à jour…" : confirm === "archive" ? "Archiver" : confirm.cta}</button></div>
      </div>
    </div>, document.body) : null}
  </>;
}
