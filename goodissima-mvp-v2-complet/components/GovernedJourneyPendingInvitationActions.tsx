"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function GovernedJourneyPendingInvitationActions({ invitationId, displayName }: { invitationId: string; displayName?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [visibleName, setVisibleName] = useState(displayName?.trim() || null);
  const revokeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => { if (confirming) cancelButtonRef.current?.focus(); }, [confirming]);

  async function revoke() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/gouvernance/invitations/${invitationId}/revoke`, { method: "POST" });
      if (!response.ok) throw new Error("revocation-failed");
      router.refresh();
    } catch {
      setError("La révocation n’a pas pu être effectuée.");
      setBusy(false);
    }
  }

  function cancel() {
    setConfirming(false);
    setError(null);
    requestAnimationFrame(() => revokeButtonRef.current?.focus());
  }

  return <div className="mt-3">
    {!confirming ? <button ref={revokeButtonRef} type="button" onClick={(event) => { setError(null); setVisibleName(displayName?.trim() || event.currentTarget.closest("li")?.querySelector("p")?.textContent?.trim() || null); setConfirming(true); }} aria-label={displayName ? `Révoquer l’invitation de ${displayName}` : "Révoquer cette invitation en attente"} className="min-h-11 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2">Révoquer l’invitation</button> : <div className="rounded-lg border border-red-200 bg-red-50 p-3" aria-live="polite">
      <p className="font-semibold text-slate-950">{visibleName ? `Révoquer l’invitation de ${visibleName} ?` : "Révoquer cette invitation ?"}</p>
      <p className="mt-1 text-sm text-slate-700">Cette personne ne pourra plus utiliser son lien personnel. L’historique de l’invitation sera conservé.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><button ref={cancelButtonRef} type="button" disabled={busy} onClick={cancel} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-slate-700 disabled:opacity-60">Annuler</button><button type="button" disabled={busy} onClick={() => void revoke()} className="min-h-11 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-60">{busy ? "Révocation…" : "Confirmer la révocation"}</button></div>
    </div>}
    {error ? <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-700">{error}</p> : null}
  </div>;
}
