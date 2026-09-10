"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { RelationSecureMediaRoom } from "@/components/RelationSecureMediaRoom";

type Mode = "audio" | "video" | "screen";
const modes: Array<{ id: Mode; icon: string; label: string }> = [
  { id: "audio", icon: "☎", label: "Audio" },
  { id: "video", icon: "▣", label: "Vidéo" },
  { id: "screen", icon: "▤", label: "Partager l’écran" },
];

export function DossierCommunicationLauncher({ caseId, actorKind, candidateAccessToken, liveKitConfigured, enabled, disabledReason }: { caseId: string; actorKind: "owner" | "candidate"; candidateAccessToken?: string; liveKitConfigured: boolean; enabled: boolean; disabledReason?: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const triggers = useRef<Record<Mode, HTMLButtonElement | null>>({ audio: null, video: null, screen: null });
  const dialog = useRef<HTMLDivElement>(null);

  function close() {
    const selected = mode;
    setMode(null);
    if (selected) requestAnimationFrame(() => triggers.current[selected]?.focus());
  }

  useEffect(() => {
    if (mode) requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("button")?.focus());
  }, [mode]);

  useEffect(() => {
    const reveal = (event: Event) => {
      const targetId = (event as CustomEvent<{ targetId?: string }>).detail?.targetId;
      if (["case-secure-media-room", "join-secure-communication", "case-secure-media-controls"].includes(targetId ?? "")) setMode("audio");
    };
    window.addEventListener("goodissima:reveal-dossier-target", reveal);
    return () => window.removeEventListener("goodissima:reveal-dossier-target", reveal);
  }, []);

  return <section aria-labelledby="communication-modes-title" className="rounded-2xl border border-[#d6e7e8] bg-white p-3 shadow-sm sm:p-4">
    <h2 id="communication-modes-title" className="text-sm font-semibold text-[#2f3437]">Communiquer avec l’interlocuteur</h2>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button type="button" disabled={!enabled} onClick={() => document.querySelector<HTMLElement>("[data-boussole-id='case-message-composer'] textarea")?.focus()} className="min-h-11 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">💬 </span>Message</button>
      {modes.map((item) => <button key={item.id} ref={(element) => { triggers.current[item.id] = element; }} type="button" disabled={!enabled} onClick={() => setMode(item.id)} className="min-h-11 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-[#247f88] outline-none hover:bg-[#e8f8f9] focus-visible:ring-2 focus-visible:ring-[#247f88] disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">{item.icon} </span>{item.label}</button>)}
    </div>
    {!enabled ? <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{disabledReason ?? "Les nouvelles communications sont interrompues dans l’état actuel de la relation."}</p> : null}
    {mode ? createPortal(<div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="dossier-media-title" className="max-h-[100dvh] w-full overflow-y-auto rounded-t-2xl bg-[#fbf7f1] p-4 shadow-2xl sm:max-w-4xl sm:rounded-2xl sm:p-5" onKeyDown={(event) => {
        if (event.key === "Escape") close();
        if (event.key === "Tab") { const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)") ?? []); const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
      }}>
        <div className="flex items-start justify-between gap-3"><div><h2 id="dossier-media-title" className="text-lg font-bold">Communication — {modes.find((item) => item.id === mode)?.label}</h2><p className="mt-1 text-sm text-slate-600">Rejoignez d’abord la salle, puis activez explicitement le média souhaité. Aucun périphérique ne démarre automatiquement.</p></div><button type="button" onClick={close} aria-label="Fermer la communication" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white text-xl">×</button></div>
        <div className="mt-4"><RelationLiveKitMediaRoom caseId={caseId} actorKind={actorKind} available={liveKitConfigured} candidateAccessToken={candidateAccessToken} joinLabel={`Rejoindre pour ${modes.find((item) => item.id === mode)?.label.toLowerCase()}`} /></div>
        {!liveKitConfigured ? <details className="mt-4 rounded-xl border bg-white p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Mode de secours</summary><p className="mb-3 text-sm text-slate-600">La salle sécurisée n’est pas disponible. Le mode navigateur reste soumis à une activation explicite.</p><RelationSecureMediaRoom caseId={caseId} role={actorKind === "owner" ? "OWNER" : "CANDIDATE"} candidateAccessToken={candidateAccessToken} /></details> : null}
      </div>
    </div>, document.body) : null}
  </section>;
}
