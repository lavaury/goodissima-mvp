"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DirectorySearchResultDto } from "@/lib/directory/directory-search-contracts";

const roles = [
  ["OTHER", "Participant"], ["OBSERVER", "Observateur"], ["EXPERT", "Expert"],
  ["JUDGE", "Juge"], ["THIRD_PARTY", "Tiers"], ["ASSOCIATION", "Association"], ["FAMILY", "Famille"],
] as const;

type Props = { formTemplateId: string; journeyTitle: string; journeyObjective?: string | null; initialParticipantRole?: string | null; initialParticipationContext?: string | null; initialGovernedRole?: string; expectedRoleId?: string; contextual?: boolean };

export function GovernedJourneyAddParticipantPanel({ formTemplateId, journeyTitle, journeyObjective, initialParticipantRole, initialParticipationContext, initialGovernedRole = "OTHER", expectedRoleId, contextual = false }: Props) {
  const [results, setResults] = useState<DirectorySearchResultDto[]>([]);
  const [selected, setSelected] = useState<DirectorySearchResultDto | null>(null);
  const [role, setRole] = useState(initialGovernedRole);
  const [externalName, setExternalName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const router = useRouter();
  const participantRole = initialParticipantRole || roles.find(([value]) => value === role)?.[1] || "Participant";
  const legacyRoleContext = initialParticipantRole === "Participant attendu";

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

  async function createInvitation(input: { displayName: string; directoryPublicId?: string }) {
    setBusy(true); setMessage(null); setLink(null);
    try {
      const response = await fetch("/api/gouvernance/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        formTemplateId, displayName: input.displayName, directoryPublicId: input.directoryPublicId, expectedRoleId,
        role, participantName: input.displayName, participantRole, expiresInDays: 7,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Invitation impossible.");
      setLink(data.link); setMessage("Invitation créée. Copiez ce lien personnel et transmettez-le uniquement à cette personne."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invitation impossible."); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setMessage("Lien copié."); }
    catch { linkRef.current?.focus(); linkRef.current?.select(); setMessage("Sélectionnez le lien pour le copier."); }
  }

  const roleControl = legacyRoleContext
    ? <p className="mt-3 text-sm"><strong>Contexte de participation :</strong> {initialParticipationContext || "Participation prévue"}</p>
    : initialParticipantRole
      ? <p className="mt-3 text-sm"><strong>Rôle proposé :</strong> {initialParticipantRole}</p>
      : <label className="mt-3 block text-sm font-semibold text-slate-700">Rôle proposé<select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;

  return <details id={contextual ? undefined : "add-participant"} open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className={`${contextual ? "mt-2" : "mt-4"} rounded-lg border border-[#247f88]/40 bg-white p-4`}>
    <summary aria-expanded={open} aria-controls={panelId} className="min-h-11 cursor-pointer py-2 font-bold text-[#176b73] outline-none focus-visible:ring-2 focus-visible:ring-cyan-700">{contextual ? "Choisir une personne" : "Ajouter un participant"}</summary>
    <div id={panelId}>
    {initialParticipantRole ? <p className="mt-2 rounded-lg bg-cyan-50 p-3 text-sm font-semibold text-cyan-950">{legacyRoleContext ? "Participation prévue — le rôle métier n’était pas renseigné dans ces données historiques." : `Rôle à pourvoir : ${initialParticipantRole}`}</p> : null}
    <section aria-labelledby="goodissima-person-title" className="mt-4 rounded-lg border bg-slate-50 p-4">
      <h4 id="goodissima-person-title" className="font-bold text-slate-950">1. Personne déjà dans Goodissima</h4>
      <p className="mt-1 text-sm text-slate-600">Recherchez une personne publiée dans Goodissima. Aucun email n’est nécessaire et aucune notification n’est envoyée automatiquement.</p>
      <form action={search} className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">Nom, métier ou compétence<input name="query" required minLength={2} maxLength={80} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="Nom, métier ou compétence" /></label>
        <button disabled={busy} className="min-h-11 self-end rounded-lg border border-[#247f88] px-4 py-2 font-bold text-[#176b73] disabled:opacity-60">Rechercher</button>
      </form>
      {results.length ? <ul className="mt-4 space-y-2" aria-label="Résultats Goodissima">{results.map((item) => <li key={item.publicId}><button type="button" onClick={() => { setSelected(item); setLink(null); setMessage(null); }} className={`min-h-11 w-full rounded-lg border p-3 text-left ${selected?.publicId === item.publicId ? "border-[#247f88] bg-cyan-50" : "bg-white"}`}><span className="block font-semibold text-slate-950">{item.publicName}</span>{item.matchReasons[0] ? <span className="mt-1 block text-xs text-slate-600">{item.matchReasons[0]}</span> : null}</button></li>)}</ul> : null}
      {selected ? <div className="mt-4 rounded-lg border bg-white p-4"><p className="font-bold text-slate-950">Inviter {selected.publicName} au parcours « {journeyTitle} »</p>{journeyObjective ? <p className="mt-1 text-sm text-slate-600">Objectif : {journeyObjective}</p> : null}{roleControl}<button type="button" disabled={busy} onClick={() => void createInvitation({ displayName: selected.publicName, directoryPublicId: selected.publicId })} className="mt-3 min-h-11 rounded-lg bg-[#247f88] px-4 py-2 font-bold text-white disabled:opacity-60">Inviter au parcours</button><p className="mt-2 text-xs text-slate-600">Prévu ≠ invité ≠ accès actif ≠ participation acceptée. La personne choisit explicitement depuis son invitation.</p></div> : null}
    </section>
    <section aria-labelledby="external-person-title" className="mt-4 rounded-lg border bg-slate-50 p-4">
      <h4 id="external-person-title" className="font-bold text-slate-950">2. Personne extérieure à Goodissima</h4>
      <p className="mt-1 text-sm text-slate-600">Préparez une invitation personnelle sécurisée. Aucun email ou SMS n’est obligatoire.</p>
      <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Cette personne pourra consulter, accepter ou refuser l’invitation avec son lien personnel, sans compte obligatoire. Le lien ne vérifie pas son identité.</p>
      <label className="mt-3 block text-sm font-semibold text-slate-700">Nom de la personne<input value={externalName} onChange={(event) => setExternalName(event.target.value)} required maxLength={120} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
      {roleControl}
      <button type="button" disabled={busy || !externalName.trim()} onClick={() => void createInvitation({ displayName: externalName.trim() })} className="mt-3 min-h-11 rounded-lg bg-[#247f88] px-4 py-2 font-bold text-white disabled:opacity-60">Créer une invitation</button>
      <p className="mt-2 text-xs text-slate-600">Le lien créé est personnel : il n’est ni public, ni collectif, ni destiné à être partagé librement.</p>
    </section>
    {link ? <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3"><p className="mb-2 text-sm font-semibold text-emerald-950">Ce lien personnel est destiné uniquement à cette invitation.</p><input ref={linkRef} readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Lien personnel d’invitation" className="w-full rounded border bg-white px-3 py-2 text-sm" /><button type="button" onClick={() => void copyLink()} className="mt-2 min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white">Copier le lien personnel</button></div> : null}
    {message ? <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{message}</p> : null}
    </div>
  </details>;
}
