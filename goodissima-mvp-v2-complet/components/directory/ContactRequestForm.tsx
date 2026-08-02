"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Source = { id: string; displayName: string };
export function ContactRequestForm({ targetId, policy, sources }: { targetId: string; policy: "OPEN" | "MESSAGE_ONLY"; sources: Source[] }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [submitting, setSubmitting] = useState(false); const [feedback, setFeedback] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (submitting) return; const form = new FormData(event.currentTarget); const channels = form.getAll("channels");
    if (!window.confirm("Confirmer l’envoi de cette demande de contact explicite ?")) return; setSubmitting(true); setFeedback("");
    try { const response = await fetch("/api/directory/contact-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requesterRepresentationId: form.get("source"), targetRepresentationId: targetId, reason: form.get("reason"), channels }) }); const payload = await response.json(); if (!response.ok) throw new Error(response.status === 409 ? "Cette demande est impossible ou existe déjà." : "La demande n’a pas pu être enregistrée."); setFeedback("Demande enregistrée. Aucun contact ni canal n’a été créé."); setOpen(false); router.refresh(); } catch (error) { setFeedback(error instanceof Error ? error.message : "Une erreur est survenue."); } finally { setSubmitting(false); }
  }
  if (!sources.length) return <p className="mt-4 text-sm text-amber-800">Créez une représentation active pour pouvoir envoyer une demande.</p>;
  return <div className="mt-4"><button type="button" onClick={() => setOpen(!open)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">{policy === "MESSAGE_ONLY" ? "Demander un échange par message" : "Demander un contact"}</button>
    {open ? <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border bg-slate-50 p-4"><label className="block text-sm font-semibold">Votre représentation<select required name="source" className="mt-1 w-full rounded-lg border bg-white px-3 py-2">{sources.map((source) => <option value={source.id} key={source.id}>{source.displayName}</option>)}</select></label>
      <label className="block text-sm font-semibold">Motif<textarea required minLength={10} maxLength={1000} name="reason" className="mt-1 min-h-24 w-full rounded-lg border bg-white px-3 py-2" /></label>
      <fieldset><legend className="text-sm font-semibold">Canaux demandés</legend><div className="mt-2 flex flex-wrap gap-4">{(["MESSAGE", ...(policy === "OPEN" ? ["VOICE", "VIDEO"] : [])] as string[]).map((channel) => <label key={channel} className="text-sm"><input required={channel === "MESSAGE" && policy === "MESSAGE_ONLY"} defaultChecked={channel === "MESSAGE"} type="checkbox" name="channels" value={channel} /> {channel === "MESSAGE" ? "Message" : channel === "VOICE" ? "Voix" : "Visio"}</label>)}</div></fieldset>
      <p className="text-xs text-slate-600">L’envoi crée uniquement une demande. Aucun contact, message, appel ou accès n’est créé.</p><button disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Envoi…" : "Confirmer et envoyer"}</button></form> : null}
    {feedback ? <p role="status" className="mt-3 text-sm">{feedback}</p> : null}</div>;
}
