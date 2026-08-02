"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isConfirmedContactRequestCreation } from "@/lib/directory/contact-request-contracts";

type Source = { id: string; displayName: string };
type Feedback = { kind: "success" | "error"; title: string; detail?: string };

const creationErrors: Record<string, string> = {
  CONFLICT: "Une demande identique est déjà en attente pour cette représentation.",
  SELF_REPRESENTATION: "Vous ne pouvez pas envoyer une demande à la même représentation.",
  SAME_OWNER: "Vous ne pouvez pas envoyer une demande entre deux de vos propres représentations.",
  POLICY_CLOSED: "Cette représentation est fermée aux nouvelles demandes.",
  POLICY_MESSAGE_ONLY: "Cette représentation accepte uniquement les demandes par message.",
  NOT_FOUND: "La représentation cible n’est plus disponible ou visible dans l’Annuaire.",
};

export function ContactRequestForm({ targetId, policy, sources }: { targetId: string; policy: "OPEN" | "MESSAGE_ONLY"; sources: Source[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function focusFeedback() { window.setTimeout(() => feedbackRef.current?.focus(), 0); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sent) return;
    const form = new FormData(event.currentTarget);
    const channels = form.getAll("channels");
    if (!window.confirm("Confirmer l’envoi de cette demande de contact explicite ?")) return;
    setSubmitting(true); setFeedback(null);
    try {
      const response = await fetch("/api/directory/contact-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterRepresentationId: form.get("source"), targetRepresentationId: targetId, reason: form.get("reason"), channels }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(creationErrors[payload.error] ?? (response.status >= 500 ? "Une erreur technique empêche l’envoi. Réessayez plus tard." : "La demande n’a pas pu être envoyée. Vérifiez les informations saisies."));
      }
      if (!isConfirmedContactRequestCreation(response.status, payload)) throw new Error("La demande n’a pas été enregistrée.");
      formRef.current?.reset(); setOpen(false); setSent(true);
      setFeedback({ kind: "success", title: "Votre demande de contact a bien été envoyée.", detail: "Vous pouvez suivre son état dans Moi > Demandes > Envoyées." });
      router.refresh(); focusFeedback();
    } catch (error) {
      setFeedback({ kind: "error", title: error instanceof Error ? error.message : "Une erreur technique empêche l’envoi. Réessayez plus tard." });
      focusFeedback();
    } finally { setSubmitting(false); }
  }

  if (!sources.length) return <p className="mt-4 text-sm text-amber-800">Créez une représentation active pour pouvoir envoyer une demande.</p>;
  return <div className="mt-4">
    {!sent ? <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">{policy === "MESSAGE_ONLY" ? "Demander un échange par message" : "Demander un contact"}</button> : null}
    {open ? <form ref={formRef} onSubmit={submit} className="mt-4 space-y-4 rounded-xl border bg-slate-50 p-4">
      <label className="block text-sm font-semibold">Votre représentation<select required name="source" className="mt-1 w-full rounded-lg border bg-white px-3 py-2">{sources.map((source) => <option value={source.id} key={source.id}>{source.displayName}</option>)}</select></label>
      <label className="block text-sm font-semibold">Motif<textarea required minLength={10} maxLength={1000} name="reason" className="mt-1 min-h-24 w-full rounded-lg border bg-white px-3 py-2" /></label>
      <fieldset><legend className="text-sm font-semibold">Canaux demandés</legend><div className="mt-2 flex flex-wrap gap-4">{(["MESSAGE", ...(policy === "OPEN" ? ["VOICE", "VIDEO"] : [])] as string[]).map((channel) => <label key={channel} className="text-sm"><input required={channel === "MESSAGE" && policy === "MESSAGE_ONLY"} defaultChecked={channel === "MESSAGE"} type="checkbox" name="channels" value={channel} /> {channel === "MESSAGE" ? "Message" : channel === "VOICE" ? "Voix" : "Visio"}</label>)}</div></fieldset>
      <p className="text-xs text-slate-600">L’envoi crée uniquement une demande. Aucun contact, message, appel ou accès n’est créé.</p>
      <button disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Envoi en cours…" : "Confirmer et envoyer la demande"}</button>
    </form> : null}
    {feedback ? <div ref={feedbackRef} tabIndex={-1} role={feedback.kind === "error" ? "alert" : "status"} aria-live={feedback.kind === "error" ? "assertive" : "polite"} className={`mt-4 rounded-xl border p-4 outline-none ${feedback.kind === "success" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <p className="font-semibold text-slate-950">{feedback.title}</p>{feedback.detail ? <p className="mt-1 text-sm text-slate-700">{feedback.detail}</p> : null}
      {feedback.kind === "success" ? <Link href="/annuaire?tab=moi&requests=outgoing" className="mt-3 inline-flex rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-900">Voir mes demandes envoyées</Link> : null}
    </div> : null}
  </div>;
}
