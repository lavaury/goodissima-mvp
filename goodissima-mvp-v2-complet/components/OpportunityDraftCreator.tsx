"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpportunityDay, OpportunityType } from "@/lib/opportunities/contracts";
import type { OpportunityIntent } from "@/lib/opportunities/opportunity-intent";
import { suggestOpportunityTitle } from "@/lib/opportunities/opportunity-intent";

const DAYS: Array<[OpportunityDay, string]> = [["MONDAY", "Lundi"], ["TUESDAY", "Mardi"], ["WEDNESDAY", "Mercredi"], ["THURSDAY", "Jeudi"], ["FRIDAY", "Vendredi"], ["SATURDAY", "Samedi"], ["SUNDAY", "Dimanche"]];
const emptyIntent: OpportunityIntent = { type: null, subject: "" };

export function OpportunityDraftCreator() {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [intent, setIntent] = useState<OpportunityIntent>(emptyIntent);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editor, setEditor] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function update(next: OpportunityIntent) {
    setIntent(next);
    if (next.subject) setTitle(suggestOpportunityTitle(next));
  }

  async function understand() {
    if (!phrase.trim()) { setError("Décrivez d’abord ce que vous recherchez ou proposez."); return; }
    setInterpreting(true); setError(""); setNotice("Interprétation en cours…");
    try {
      const response = await fetch("/api/opportunities/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phrase }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("UNAVAILABLE");
      setIntent(body.intent); setTitle(body.title); setDescription(body.description); setEditor(true); setNotice("Proposition prête à être vérifiée.");
    } catch {
      setIntent(emptyIntent); setDescription(phrase.trim()); setTitle(""); setEditor(true);
      setNotice("Nous n’avons pas pu interpréter automatiquement votre demande. Vous pouvez continuer manuellement.");
    } finally { setInterpreting(false); }
  }

  function manual() {
    setIntent(emptyIntent); setDescription(phrase.trim()); setTitle(""); setEditor(true); setError(""); setNotice("Saisie manuelle ouverte.");
  }

  async function createDraft() {
    if (!intent.type || !intent.subject.trim() || !title.trim() || !description.trim()) { setError("Choisissez Je recherche ou Je propose, puis renseignez l’objet, le titre et la description."); return; }
    if ((intent.priceMin !== undefined || intent.priceMax !== undefined) && !intent.currency) { setError("Indiquez la devise lorsque vous renseignez un prix."); return; }
    setCreating(true); setError("");
    const criteria = {
      subject: intent.subject.trim(), ...(intent.category ? { category: intent.category } : {}),
      ...(intent.locations?.length ? { locations: intent.locations } : {}),
      ...(intent.days?.length || intent.timeFrom || intent.timeTo ? { availability: { ...(intent.days?.length ? { days: intent.days } : {}), ...(intent.timeFrom ? { timeFrom: intent.timeFrom } : {}), ...(intent.timeTo ? { timeTo: intent.timeTo } : {}) } } : {}),
      ...(intent.dateFrom || intent.dateTo ? { dateWindow: { ...(intent.dateFrom ? { from: intent.dateFrom } : {}), ...(intent.dateTo ? { to: intent.dateTo } : {}) } } : {}),
      ...(intent.priceMin !== undefined || intent.priceMax !== undefined ? { priceRange: { ...(intent.priceMin !== undefined ? { min: intent.priceMin } : {}), ...(intent.priceMax !== undefined ? { max: intent.priceMax } : {}), currency: intent.currency! } } : {}),
      ...((intent.additionalTerms?.length || intent.clarifications?.length) ? { terms: [...new Set([...(intent.additionalTerms ?? []), ...(intent.clarifications ?? [])])] } : {}),
    };
    try {
      const response = await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: intent.type, criteria, title, description }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.id !== "string") throw new Error("CREATE_FAILED");
      router.push(`/opportunities/${encodeURIComponent(body.id)}`); router.refresh();
    } catch { setError("Le brouillon n’a pas pu être créé. Vérifiez les informations et réessayez."); setCreating(false); }
  }

  const setList = (key: "locations" | "additionalTerms", value: string) => setIntent((current) => ({ ...current, [key]: value.split(",").map((item) => item.trim()).filter(Boolean) }));
  return <div className="space-y-6">
    <section data-boussole-id="opportunity-intent" className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Créer une opportunité</p>
      <h1 className="mt-2 text-3xl font-bold text-cyan-950">Que recherchez-vous ou proposez-vous ?</h1>
      <label htmlFor="opportunity-phrase" className="mt-5 block text-sm font-semibold text-cyan-950">Décrivez votre besoin ou votre offre</label>
      <textarea id="opportunity-phrase" value={phrase} onChange={(event) => setPhrase(event.target.value)} rows={5} aria-describedby="opportunity-example opportunity-error" className="mt-2 w-full rounded-2xl border border-cyan-300 bg-white p-4 text-base outline-none focus:ring-2 focus:ring-cyan-700" placeholder="Je recherche une baby-sitter le mardi et jeudi à partir de 18h à Beauvais." />
      <p id="opportunity-example" className="mt-2 text-sm text-cyan-800">Exemple : « Je recherche une baby-sitter le mardi et jeudi à partir de 18h à Beauvais. »</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button data-boussole-id="understand-opportunity" type="button" onClick={() => void understand()} disabled={interpreting} className="min-h-11 rounded-xl bg-cyan-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{interpreting ? "Interprétation…" : "Comprendre ma demande"}</button>
        <button type="button" onClick={manual} className="min-h-11 rounded-xl border border-cyan-300 bg-white px-5 py-3 font-semibold text-cyan-950">Saisir manuellement</button>
      </div>
      {notice ? <p role="status" aria-live="polite" className="mt-3 text-sm text-cyan-900">{notice}</p> : null}
      {!editor && error ? <p id="opportunity-error" role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </section>

    {editor ? <section data-boussole-id="opportunity-understood" className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-bold">Nous avons compris</h2>
      <p className="mt-1 text-sm text-slate-600">Relisez et corrigez ces informations. Rien n’est enregistré avant votre validation.</p>
      <fieldset className="mt-5"><legend className="font-semibold">Que souhaitez-vous faire ?</legend><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
        {(["NEED", "OFFER"] as OpportunityType[]).map((type) => <label key={type} className="flex min-h-11 items-center gap-2 rounded-xl border px-4"><input type="radio" name="opportunity-type" checked={intent.type === type} onChange={() => update({ ...intent, type })} />{type === "NEED" ? "Je recherche" : "Je propose"}</label>)}
      </div></fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="font-semibold">Objet<input value={intent.subject} onChange={(e) => update({ ...intent, subject: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal focus:ring-2" /></label>
        <label className="font-semibold">Lieu(x)<input value={intent.locations?.join(", ") ?? ""} onChange={(e) => setList("locations", e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal focus:ring-2" placeholder="Beauvais, Amiens" /></label>
      </div>
      <div className="mt-4 grid gap-4">
        <label className="font-semibold">Titre<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal focus:ring-2" /></label>
        <label className="font-semibold">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal focus:ring-2" /></label>
      </div>
      <details className="mt-5 rounded-2xl border p-4"><summary className="cursor-pointer font-semibold">Ajouter ou corriger des critères</summary>
        <div className="mt-4 space-y-4">
          <label className="block font-semibold">Catégorie<input value={intent.category ?? ""} onChange={(e) => setIntent({ ...intent, category: e.target.value || undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label>
          <fieldset><legend className="font-semibold">Jours</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{DAYS.map(([day, label]) => <label key={day} className="flex items-center gap-2"><input type="checkbox" checked={intent.days?.includes(day) ?? false} onChange={(e) => setIntent({ ...intent, days: e.target.checked ? [...(intent.days ?? []), day] : intent.days?.filter((value) => value !== day) })} />{label}</label>)}</div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><label className="font-semibold">Heure de début<input type="time" value={intent.timeFrom ?? ""} onChange={(e) => setIntent({ ...intent, timeFrom: e.target.value || undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label><label className="font-semibold">Heure de fin<input type="time" value={intent.timeTo ?? ""} onChange={(e) => setIntent({ ...intent, timeTo: e.target.value || undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="font-semibold">Date de début<input type="date" value={intent.dateFrom ?? ""} onChange={(e) => setIntent({ ...intent, dateFrom: e.target.value || undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label><label className="font-semibold">Date de fin<input type="date" value={intent.dateTo ?? ""} onChange={(e) => setIntent({ ...intent, dateTo: e.target.value || undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label></div>
          <div className="grid gap-4 sm:grid-cols-3"><label className="font-semibold">Prix minimum<input type="number" min="0" value={intent.priceMin ?? ""} onChange={(e) => setIntent({ ...intent, priceMin: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label><label className="font-semibold">Prix maximum<input type="number" min="0" value={intent.priceMax ?? ""} onChange={(e) => setIntent({ ...intent, priceMax: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label><label className="font-semibold">Devise<input value={intent.currency ?? ""} placeholder="EUR" maxLength={3} onChange={(e) => setIntent({ ...intent, currency: e.target.value.toUpperCase() || undefined })} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label></div>
          <label className="block font-semibold">Critères complémentaires<input value={intent.additionalTerms?.join(", ") ?? ""} onChange={(e) => setList("additionalTerms", e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" placeholder="Séparez les critères par une virgule" /></label>
          {intent.clarifications?.length ? <div><p className="font-semibold">À préciser</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{intent.clarifications.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        </div>
      </details>
      <button data-boussole-id="create-opportunity-draft" type="button" onClick={() => void createDraft()} disabled={creating} className="mt-6 min-h-12 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50 sm:w-auto">{creating ? "Création…" : "Créer le brouillon"}</button>
      {error ? <p id="opportunity-error" role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </section> : null}
  </div>;
}
