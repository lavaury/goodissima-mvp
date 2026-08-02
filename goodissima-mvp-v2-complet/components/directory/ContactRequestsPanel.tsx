"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type RequestRow = { id: string; direction: "incoming" | "outgoing"; source: { displayName: string }; target: { displayName: string }; reason: string; channels: string[]; contextType: string | null; contextId: string | null; status: string; expiresAt: string | null; deferredUntil: string | null; contactCreatedAt: string | null; createdAt: string; updatedAt: string };
const labels: Record<string, string> = { PENDING: "En attente", ACCEPTED: "Acceptée", REFUSED: "Refusée", DEFERRED: "Reportée", CANCELLED: "Annulée", EXPIRED: "Expirée" };
const channelLabels: Record<string, string> = { MESSAGE: "Message", VOICE: "Voix", VIDEO: "Visio" };
const successLabels: Record<string, string> = { accept: "La demande a été acceptée.", refuse: "La demande a été refusée.", defer: "La demande a été reportée.", resume: "La demande est de nouveau en attente de votre décision.", cancel: "La demande envoyée a été annulée." };

function requiresDecision(row: RequestRow) { return row.status === "PENDING" || (row.status === "DEFERRED" && Boolean(row.deferredUntil && Date.parse(row.deferredUntil) <= Date.now())); }

export function ContactRequestsPanel({ incoming: incomingProps, outgoing: outgoingProps, initialTab = "incoming" }: { incoming: RequestRow[]; outgoing: RequestRow[]; initialTab?: "incoming" | "outgoing" }) {
  const router = useRouter(); const feedbackRef = useRef<HTMLDivElement>(null);
  const [incoming, setIncoming] = useState(incomingProps); const [outgoing, setOutgoing] = useState(outgoingProps);
  const initialPending = incomingProps.some(requiresDecision);
  const [tab, setTab] = useState<"incoming" | "outgoing">(initialPending ? "incoming" : initialTab);
  const [busy, setBusy] = useState<string | null>(null); const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  useEffect(() => { setIncoming(incomingProps); setOutgoing(outgoingProps); }, [incomingProps, outgoingProps]);
  const pendingCount = incoming.filter(requiresDecision).length; const rows = tab === "incoming" ? incoming : outgoing;

  function showFeedback(kind: "success" | "error", text: string) { setFeedback({ kind, text }); window.setTimeout(() => feedbackRef.current?.focus(), 0); }
  async function mutate(row: RequestRow, action: string) {
    if (busy) return;
    if (action === "accept" && !window.confirm("Accepter enregistre votre accord pour cette demande. Aucun contact, message, appel ou accès n’est encore créé.")) return;
    if (["refuse", "cancel"].includes(action) && !window.confirm("Confirmer cette décision ? Aucun effet annexe ne sera déclenché.")) return;
    let deferredUntil: string | undefined;
    if (action === "defer") { deferredUntil = window.prompt("Date de reprise (entre 1 et 30 jours, format AAAA-MM-JJ)") ?? undefined; if (!deferredUntil) return; deferredUntil = new Date(`${deferredUntil}T12:00:00.000Z`).toISOString(); }
    setBusy(row.id); setFeedback(null);
    try {
      const response = await fetch(`/api/directory/contact-requests/${encodeURIComponent(row.id)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: row.updatedAt, ...(deferredUntil ? { deferredUntil } : {}) }) });
      const payload = await response.json();
      if (!response.ok || !payload.request) throw new Error(response.status === 410 ? "Cette demande a expiré et ne peut plus être modifiée." : response.status === 409 ? "La demande a changé ou cette décision n’est plus autorisée. La liste va être actualisée." : response.status === 404 ? "Cette demande n’est plus disponible." : "Une erreur technique empêche l’enregistrement de la décision.");
      const update = (items: RequestRow[]) => items.map((item) => item.id === row.id ? payload.request : item);
      if (tab === "incoming") setIncoming(update); else setOutgoing(update);
      showFeedback("success", successLabels[action] ?? "La décision a bien été enregistrée."); router.refresh();
    } catch (error) { showFeedback("error", error instanceof Error ? error.message : "Une erreur technique est survenue."); }
    finally { setBusy(null); }
  }

  async function createContact(row: RequestRow) {
    if (busy) return;
    if (!window.confirm("Cette action ajoutera cette représentation à vos contacts et ajoutera réciproquement votre représentation aux contacts du destinataire. Aucun message, appel ou accès ne sera créé.")) return;
    setBusy(row.id); setFeedback(null);
    try {
      const response = await fetch(`/api/directory/contact-requests/${encodeURIComponent(row.id)}/create-contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: row.updatedAt }) });
      const payload = await response.json();
      if (!response.ok || !payload.contact?.id || !payload.contact?.createdAt) throw new Error(response.status === 409 ? "Cette demande ne permet plus de créer le contact." : response.status === 404 ? "Cette demande n’est plus accessible." : "Le contact n’a pas pu être créé.");
      const update = (items: RequestRow[]) => items.map((item) => item.id === row.id ? { ...item, contactCreatedAt: payload.contact.createdAt } : item);
      setIncoming(update); setOutgoing(update); showFeedback("success", payload.created ? "Le contact réciproque a bien été créé pour les deux parties." : "Le contact avait déjà été créé."); router.refresh();
    } catch (error) { showFeedback("error", error instanceof Error ? error.message : "Une erreur technique est survenue."); }
    finally { setBusy(null); }
  }

  return <section aria-labelledby="pending-requests-title" className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm md:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Actions relationnelles</p><h2 id="pending-requests-title" className="mt-1 text-xl font-semibold text-slate-950">Demandes <span className="sr-only">— {pendingCount} en attente</span></h2></div><span aria-label={`${pendingCount} demandes reçues nécessitent votre attention`} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">{pendingCount} en attente</span></div>
    {pendingCount > 0 ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-950">Vous avez {pendingCount} {pendingCount > 1 ? "demandes de contact en attente" : "demande de contact en attente"}.</p><button type="button" onClick={() => setTab("incoming")} className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white">Voir les demandes reçues</button></div> : null}
    <div role="tablist" aria-label="Demandes de contact" className="mt-5 flex gap-2"><button type="button" role="tab" aria-selected={tab === "incoming"} onClick={() => setTab("incoming")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Reçues{pendingCount ? ` (${pendingCount})` : ""}</button><button type="button" role="tab" aria-selected={tab === "outgoing"} onClick={() => setTab("outgoing")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Envoyées</button></div>
    {feedback ? <div ref={feedbackRef} tabIndex={-1} role={feedback.kind === "error" ? "alert" : "status"} aria-live={feedback.kind === "error" ? "assertive" : "polite"} className={`mt-4 rounded-lg border p-3 text-sm outline-none ${feedback.kind === "success" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className="font-semibold">{feedback.text}</p>{feedback.kind === "success" ? <p className="mt-1">La liste et le compteur ont été mis à jour. Aucun contact ni canal n’a été créé.</p> : null}</div> : null}
    {rows.length ? <ul className="mt-4 space-y-4">{rows.map((row) => <li key={row.id} className="rounded-xl border p-4"><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-900">Représentation source</dt><dd>{row.source.displayName}</dd></div><div><dt className="font-semibold text-slate-900">Représentation cible</dt><dd>{row.target.displayName}</dd></div><div className="sm:col-span-2"><dt className="font-semibold text-slate-900">Motif</dt><dd className="mt-1 whitespace-pre-wrap">{row.reason}</dd></div><div><dt className="font-semibold text-slate-900">Canaux demandés</dt><dd>{row.channels.map((channel) => channelLabels[channel] ?? channel).join(", ")}</dd></div><div><dt className="font-semibold text-slate-900">Statut</dt><dd>{labels[row.status] ?? row.status}</dd></div><div><dt className="font-semibold text-slate-900">Date d’envoi</dt><dd>{new Date(row.createdAt).toLocaleDateString("fr-FR")}</dd></div>{row.expiresAt ? <div><dt className="font-semibold text-slate-900">Date limite</dt><dd>{new Date(row.expiresAt).toLocaleDateString("fr-FR")}</dd></div> : null}</dl>
      {tab === "outgoing" && row.status === "PENDING" ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">En attente de réponse du destinataire.</p> : null}
      {tab === "incoming" && requiresDecision(row) ? <p className="mt-3 font-semibold text-amber-900">Cette demande nécessite votre décision.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">{tab === "incoming" && row.status === "PENDING" ? <>{(["accept", "refuse", "defer"] as const).map((action) => { const actionLabel = { accept: "Accepter", refuse: "Refuser", defer: "Reporter" }[action]; return <button type="button" disabled={busy === row.id} onClick={() => mutate(row, action)} key={action} aria-label={`${actionLabel} la demande de ${row.source.displayName}`} className="rounded-lg border px-3 py-1 text-sm">{actionLabel}</button>; })}</> : null}{tab === "incoming" && row.status === "DEFERRED" && requiresDecision(row) ? <button type="button" disabled={busy === row.id} onClick={() => mutate(row, "resume")} className="rounded-lg border px-3 py-1 text-sm">Reprendre l’examen de la demande</button> : null}{tab === "outgoing" && ["PENDING", "DEFERRED"].includes(row.status) ? <button type="button" disabled={busy === row.id} onClick={() => mutate(row, "cancel")} className="rounded-lg border px-3 py-1 text-sm">Annuler la demande envoyée</button> : null}</div>
      {row.status === "ACCEPTED" && !row.contactCreatedAt ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm font-semibold text-emerald-950">Cette demande est acceptée. Le contact n’a pas encore été créé.</p><button type="button" disabled={busy === row.id} onClick={() => createContact(row)} className="mt-3 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">Créer le contact</button></div> : null}
      {row.status === "ACCEPTED" && row.contactCreatedAt ? <div className="mt-4 rounded-lg bg-emerald-50 p-3"><p className="text-sm font-semibold text-emerald-950">Le contact a été créé.</p><a href="#my-contacts-title" className="mt-2 inline-flex text-sm font-semibold underline">Voir dans Mes contacts</a></div> : null}</li>)}</ul> : <p className="mt-4 rounded-xl border border-dashed p-5 text-sm text-slate-600">Aucune demande {tab === "incoming" ? "reçue" : "envoyée"}.</p>}
  </section>;
}
