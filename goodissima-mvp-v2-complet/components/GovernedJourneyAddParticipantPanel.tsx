"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DirectorySearchResultDto } from "@/lib/directory/directory-search-contracts";

const roles = [
  ["OTHER", "Participant"], ["OBSERVER", "Observateur"], ["EXPERT", "Expert"],
  ["JUDGE", "Juge"], ["THIRD_PARTY", "Tiers"], ["ASSOCIATION", "Association"], ["FAMILY", "Famille"],
] as const;

export function GovernedJourneyAddParticipantPanel({ formTemplateId, journeyTitle, journeyObjective }: { formTemplateId: string; journeyTitle: string; journeyObjective?: string | null }) {
  const [results, setResults] = useState<DirectorySearchResultDto[]>([]);
  const [selected, setSelected] = useState<DirectorySearchResultDto | null>(null);
  const [role, setRole] = useState("OTHER");
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function search(formData: FormData) {
    const query = String(formData.get("query") ?? "").trim();
    if (query.length < 2) return;
    setBusy(true); setMessage(null); setSelected(null); setLink(null);
    try {
      const response = await fetch("/api/directory/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorType: "PERSON", text: query, limit: 10 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Recherche impossible.");
      setResults(data.items ?? []);
      if (!(data.items ?? []).length) setMessage("Aucune personne publiée ne correspond à cette recherche.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Recherche impossible."); }
    finally { setBusy(false); }
  }

  async function invite() {
    if (!selected) return;
    setBusy(true); setMessage(null); setLink(null);
    try {
      const response = await fetch("/api/gouvernance/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        formTemplateId, directoryPublicId: selected.publicId, role, participantName: selected.publicName,
        participantRole: roles.find(([value]) => value === role)?.[1] ?? "Participant", expiresInDays: 7,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Invitation impossible.");
      setLink(data.link); setMessage("Invitation créée. Copiez ce lien personnel et transmettez-le à la personne."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invitation impossible."); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setMessage("Lien copié."); }
    catch { linkRef.current?.focus(); linkRef.current?.select(); setMessage("Sélectionnez le lien pour le copier."); }
  }

  return <details id="add-participant" className="mt-4 rounded-lg border border-[#247f88]/40 bg-white p-4">
    <summary className="min-h-11 cursor-pointer py-2 font-bold text-[#176b73]">Ajouter un participant</summary>
    <p className="mt-2 text-sm text-slate-600">Recherchez une personne publiée dans Goodissima. Aucun email n’est nécessaire et aucune notification n’est envoyée automatiquement.</p>
    <form action={search} className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
      <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">Rechercher dans Goodissima
        <input name="query" required minLength={2} maxLength={80} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="Nom, métier ou compétence" />
      </label>
      <button disabled={busy} className="min-h-11 self-end rounded-lg border border-[#247f88] px-4 py-2 font-bold text-[#176b73] disabled:opacity-60">Rechercher</button>
    </form>
    {results.length ? <ul className="mt-4 space-y-2" aria-label="Résultats Goodissima">{results.map((item) => <li key={item.publicId}>
      <button type="button" onClick={() => { setSelected(item); setLink(null); setMessage(null); }} className={`min-h-11 w-full rounded-lg border p-3 text-left ${selected?.publicId === item.publicId ? "border-[#247f88] bg-cyan-50" : "bg-white"}`}>
        <span className="block font-semibold text-slate-950">{item.publicName}</span>
        {item.matchReasons[0] ? <span className="mt-1 block text-xs text-slate-600">{item.matchReasons[0]}</span> : null}
      </button>
    </li>)}</ul> : null}
    {selected ? <div className="mt-4 rounded-lg border bg-slate-50 p-4">
      <p className="font-bold text-slate-950">Inviter {selected.publicName} au parcours « {journeyTitle} »</p>
      {journeyObjective ? <p className="mt-1 text-sm text-slate-600">Objectif : {journeyObjective}</p> : null}
      <label className="mt-3 block text-sm font-semibold text-slate-700">Rôle proposé<select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void invite()} className="mt-3 min-h-11 rounded-lg bg-[#247f88] px-4 py-2 font-bold text-white disabled:opacity-60">Inviter au parcours</button>
      <p className="mt-2 text-xs text-slate-600">Prévu ≠ invité ≠ accès actif ≠ invitation acceptée. Goodissima ne suit pas encore l’acceptation formelle.</p>
    </div> : null}
    {link ? <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3"><p className="mb-2 text-sm font-semibold text-emerald-950">Ce lien personnel est destiné uniquement à cette invitation.</p><input ref={linkRef} readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Lien personnel d’invitation" className="w-full rounded border bg-white px-3 py-2 text-sm" /><button type="button" onClick={() => void copyLink()} className="mt-2 min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white">Copier le lien personnel</button></div> : null}
    {message ? <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{message}</p> : null}
  </details>;
}
