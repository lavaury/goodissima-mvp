"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function GovernedJourneyActiveGuestAccessActions({ invitationId, displayName }: { invitationId: string; displayName: string }) {
  const [mode, setMode] = useState<"idle" | "rotate" | "revoke">("idle");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function rotate() {
    setBusy(true); setMessage(null); setLink(null);
    const response = await fetch(`/api/gouvernance/invitations/${invitationId}/rotate`, { method: "POST" });
    const payload = await response.json().catch(() => ({})) as { link?: string; error?: string };
    setBusy(false);
    if (!response.ok || !payload.link) { setMessage(payload.error ?? "Le renouvellement a échoué."); return; }
    setLink(payload.link); setMode("idle"); setMessage("Nouveau lien créé. Copiez-le maintenant : il ne sera plus affiché ensuite."); router.refresh();
  }

  async function revoke() {
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/gouvernance/invitations/${invitationId}/revoke`, { method: "POST" });
    setBusy(false);
    if (!response.ok) { setMessage("La révocation n’a pas pu être effectuée."); return; }
    router.refresh();
  }

  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setMessage("Lien copié."); }
    catch { inputRef.current?.focus(); inputRef.current?.select(); setMessage("Sélectionnez le lien pour le copier manuellement."); }
  }

  return <div className="mt-3">
    {mode === "idle" ? <button type="button" onClick={() => { setMode("rotate"); setMessage(null); }} className="min-h-11 rounded-lg border border-[#247f88] bg-white px-3 py-2 text-sm font-bold text-[#176b73]">Gérer l’accès</button> : null}
    {mode === "rotate" ? <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3" aria-live="polite">
      <p className="font-semibold text-slate-950">Renouveler le lien personnel de {displayName} ?</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy} onClick={() => setMode("idle")} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Annuler</button><button type="button" disabled={busy} onClick={() => void rotate()} className="min-h-11 rounded-lg bg-[#247f88] px-3 py-2 text-sm font-semibold text-white">{busy ? "Création…" : "Créer un nouveau lien"}</button></div>
      <button type="button" disabled={busy} onClick={() => setMode("revoke")} className="mt-3 min-h-11 text-sm font-bold text-red-800 underline">Révoquer l’accès au parcours</button>
    </div> : null}
    {mode === "revoke" ? <div className="rounded-lg border border-red-200 bg-red-50 p-3" aria-live="polite">
      <p className="font-semibold text-slate-950">Révoquer l’accès de {displayName} au parcours ?</p>
      <p className="mt-1 text-sm text-slate-700">Cette personne ne pourra plus utiliser son lien personnel ni accéder au parcours. Son historique de participation sera conservé.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy} onClick={() => setMode("rotate")} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Annuler</button><button type="button" disabled={busy} onClick={() => void revoke()} className="min-h-11 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">{busy ? "Révocation…" : "Confirmer la révocation"}</button></div>
    </div> : null}
    {link ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="font-semibold text-emerald-950">Nouveau lien personnel</p><input ref={inputRef} readOnly value={link} onFocus={event => event.currentTarget.select()} className="mt-2 w-full rounded border bg-white px-2 py-2 text-sm" /><button type="button" onClick={() => void copy()} className="mt-2 min-h-11 rounded bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">Copier le lien</button></div> : null}
    {message ? <p role="status" className="mt-2 text-sm font-semibold text-slate-700">{message}</p> : null}
  </div>;
}
