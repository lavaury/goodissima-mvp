"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { DirectorySearchResultDto } from "@/lib/directory/directory-search-contracts";
import { assignCurrentUserToExpectedRoleAction, assignJourneyParticipantToExpectedRoleAction } from "@/lib/governed-journey-role-assignment-actions";
import type { JourneyMatchingContext } from "@/lib/journey-matching-context";

const roles = [["OTHER", "Participant"], ["OBSERVER", "Observateur"], ["EXPERT", "Expert"], ["JUDGE", "Juge"], ["THIRD_PARTY", "Tiers"], ["ASSOCIATION", "Association"], ["FAMILY", "Famille"]] as const;
const modes = ["DIRECTORY", "MATCHING", "DIRECT"] as const;
type Mode = (typeof modes)[number];
type JourneyParticipant = { invitationId: string; displayName: string; identified: boolean };
type InvitationResult = { candidateId: string; candidateName: string; status: "INVITED" | "ALREADY_INVITED" | "ALREADY_PRESENT" | "SKIPPED"; deliveryUrl?: string };
type Props = { formTemplateId: string; governedJourneyId?: string; journeyParticipants?: JourneyParticipant[]; matchingContexts?: JourneyMatchingContext[]; journeyTitle: string; journeyObjective?: string | null; initialParticipantRole?: string | null; initialParticipationContext?: string | null; initialGovernedRole?: string; expectedRoleId?: string; contextual?: boolean };
const resultLabel: Record<InvitationResult["status"], string> = { INVITED: "Invitation préparée", ALREADY_INVITED: "Déjà invité", ALREADY_PRESENT: "Déjà participante", SKIPPED: "Non invitable" };

export function GovernedJourneyAddParticipantPanel({ formTemplateId, governedJourneyId, journeyParticipants = [], matchingContexts = [], journeyTitle, journeyObjective, initialParticipantRole, initialParticipationContext, initialGovernedRole = "OTHER", expectedRoleId, contextual = false }: Props) {
  const [mode, setMode] = useState<Mode>("DIRECTORY");
  const relatedMatchingRuns = matchingContexts.filter((context) => context.belongsToCurrentJourney);
  const otherMatchingRuns = matchingContexts.filter((context) => !context.belongsToCurrentJourney);
  const [selectedMatchingRunId, setSelectedMatchingRunId] = useState(relatedMatchingRuns[0]?.runId ?? "");
  const [results, setResults] = useState<DirectorySearchResultDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedForRole, setSelectedForRole] = useState<DirectorySearchResultDto | null>(null);
  const [inviteResults, setInviteResults] = useState<InvitationResult[]>([]);
  const [confirming, setConfirming] = useState(false);
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
  const selectedMatching = matchingContexts.find((context) => context.runId === selectedMatchingRunId);
  const matchingDate = selectedMatching ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(selectedMatching.completedAt ?? selectedMatching.createdAt)) : null;

  async function search(formData: FormData) {
    const query = String(formData.get("query") ?? "").trim();
    if (query.length < 2) return;
    setBusy(true); setMessage(null); setSelectedIds([]); setSelectedForRole(null); setInviteResults([]); setConfirming(false); setLink(null);
    try {
      const response = await fetch("/api/directory/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorType: "PERSON", text: query, limit: 10 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Recherche impossible.");
      setResults(data.items ?? []);
      if (!(data.items ?? []).length) setMessage("Aucune personne publiée ne correspond à cette recherche.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Recherche impossible."); }
    finally { setBusy(false); }
  }

  async function inviteDirectorySelection() {
    if (!governedJourneyId || !selectedIds.length) return;
    if (!confirming) { setConfirming(true); return; }
    setBusy(true); setMessage(null); setInviteResults([]);
    try {
      const response = await fetch("/api/gouvernance/selections/journey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "DIRECTORY", journeyId: governedJourneyId, candidateIds: selectedIds }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Invitation impossible.");
      setInviteResults(data.results ?? []); setSelectedIds([]); setConfirming(false);
      setMessage(`${data.summary?.invited ?? 0} invitation(s) préparée(s).`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invitation impossible."); }
    finally { setBusy(false); }
  }

  async function createInvitation(input: { displayName: string; directoryPublicId?: string }) {
    setBusy(true); setMessage(null); setLink(null);
    try {
      const response = await fetch("/api/gouvernance/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ formTemplateId, displayName: input.displayName, directoryPublicId: input.directoryPublicId, expectedRoleId, role, participantName: input.displayName, participantRole, expiresInDays: 7 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Invitation impossible.");
      setLink(data.link); setMessage("Invitation créée. Copiez ce lien personnel et transmettez-le uniquement à cette personne."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invitation impossible."); }
    finally { setBusy(false); }
  }

  async function copy(value: string, fallback?: HTMLInputElement | null) {
    try { await navigator.clipboard.writeText(value); setMessage("Lien copié."); }
    catch { fallback?.focus(); fallback?.select(); setMessage("Sélectionnez le lien pour le copier."); }
  }

  function moveTab(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = modes[(modes.indexOf(mode) + offset + modes.length) % modes.length];
    setMode(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
  }

  const roleControl = legacyRoleContext
    ? <p className="mt-3 text-sm"><strong>Contexte de participation :</strong> {initialParticipationContext || "Participation prévue"}</p>
    : initialParticipantRole
      ? <p className="mt-3 text-sm"><strong>Rôle proposé :</strong> {initialParticipantRole}</p>
      : <label className="mt-3 block text-sm font-semibold text-slate-700">Rôle proposé<select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;

  const directorySection = <section id={`${panelId}-directory`} role={contextual ? undefined : "tabpanel"} data-boussole-id={contextual ? undefined : "journey-participant-directory"} aria-labelledby={contextual ? "goodissima-person-title" : `${panelId}-directory-tab`} className="mt-4 rounded-lg border bg-slate-50 p-4">
    <h4 id="goodissima-person-title" className="font-bold text-slate-950">{expectedRoleId ? "3. Rechercher / inviter une personne" : "Annuaire"}</h4>
    <p className="mt-1 text-sm text-slate-600">Personne déjà dans Goodissima : recherchez un profil publié par nom, métier ou compétence. Aucun email n’est nécessaire et aucune notification n’est envoyée automatiquement.</p>
    <p className="mt-2 text-sm"><strong>Parcours :</strong> {journeyTitle}</p>
    <form action={search} className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row"><label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">Nom, métier ou compétence<input name="query" required minLength={2} maxLength={80} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="Nom, métier ou compétence" /></label><button disabled={busy} className="min-h-11 self-end rounded-lg border border-[#247f88] px-4 py-2 font-bold text-[#176b73] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 disabled:opacity-60">Rechercher</button></form>
    {results.length ? <ul className="mt-4 space-y-2" aria-label="Résultats Goodissima">{results.map((item) => <li key={item.publicId}><label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${selectedIds.includes(item.publicId) || selectedForRole?.publicId === item.publicId ? "border-[#247f88] bg-cyan-50" : "bg-white"}`}><input type={contextual ? "radio" : "checkbox"} name={contextual ? `${panelId}-person` : undefined} checked={contextual ? selectedForRole?.publicId === item.publicId : selectedIds.includes(item.publicId)} onChange={() => contextual ? setSelectedForRole(item) : setSelectedIds((current) => current.includes(item.publicId) ? current.filter((id) => id !== item.publicId) : [...current, item.publicId])} className="mt-1" /><span><span className="block font-semibold text-slate-950">{item.publicName}</span>{item.matchReasons[0] ? <span className="mt-1 block text-xs text-slate-600">{item.matchReasons[0]}</span> : null}</span></label></li>)}</ul> : null}
    {!contextual && results.length ? <div className="mt-4 rounded-lg border bg-white p-4"><p className="font-semibold">{selectedIds.length} personne{selectedIds.length > 1 ? "s" : ""} sélectionnée{selectedIds.length > 1 ? "s" : ""}</p>{confirming ? <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm"><p className="font-semibold">Confirmer les invitations dans « {journeyTitle} »</p><ul className="mt-2 list-disc pl-5">{results.filter((item) => selectedIds.includes(item.publicId)).map((item) => <li key={item.publicId}>{item.publicName}</li>)}</ul></div> : null}<button type="button" disabled={busy || !selectedIds.length || !governedJourneyId} onClick={() => void inviteDirectorySelection()} className="mt-3 min-h-11 rounded-lg bg-[#247f88] px-4 py-2 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 disabled:opacity-60">{confirming ? "Confirmer les invitations" : "Inviter dans ce Parcours"}</button>{!governedJourneyId ? <p role="alert" className="mt-2 text-sm text-red-700">Ce Parcours n’est pas disponible pour les invitations.</p> : null}</div> : null}
    {contextual && selectedForRole ? <div className="mt-4 rounded-lg border bg-white p-4"><p className="font-bold text-slate-950">Inviter {selectedForRole.publicName} au parcours « {journeyTitle} »</p>{journeyObjective ? <p className="mt-1 text-sm text-slate-600">Objectif : {journeyObjective}</p> : null}{roleControl}<button type="button" disabled={busy} onClick={() => void createInvitation({ displayName: selectedForRole.publicName, directoryPublicId: selectedForRole.publicId })} className="mt-3 min-h-11 rounded-lg bg-[#247f88] px-4 py-2 font-bold text-white disabled:opacity-60">Inviter au parcours</button><p className="mt-2 text-xs text-slate-600">Invitation d’abord, consentement ensuite. Aucun rôle n’est affecté automatiquement. La personne choisit explicitement depuis son invitation.</p></div> : null}
    {inviteResults.length ? <ul className="mt-4 divide-y rounded-lg border bg-white" aria-label="Résultats des invitations">{inviteResults.map((item) => <li key={item.candidateId} className="flex flex-wrap items-center justify-between gap-3 p-3"><p><strong>{item.candidateName}</strong> — {resultLabel[item.status]}</p>{item.status === "INVITED" && item.deliveryUrl ? <button type="button" onClick={() => void copy(item.deliveryUrl!)} className="min-h-11 rounded-lg border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Copier le lien</button> : null}</li>)}</ul> : null}
  </section>;

  const directSection = <section id={`${panelId}-direct`} role={contextual ? undefined : "tabpanel"} data-boussole-id={contextual ? undefined : "journey-participant-direct-invite"} aria-labelledby={contextual ? "external-person-title" : `${panelId}-direct-tab`} className="mt-4 rounded-lg border bg-slate-50 p-4">
    <h4 id="external-person-title" className="font-bold text-slate-950">{expectedRoleId ? "4. Invitation directe" : "Invitation directe"}</h4><p className="mt-1 text-sm text-slate-600">Préparez une invitation personnelle sécurisée. Aucun email ou SMS n’est obligatoire.</p><p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Cette personne pourra consulter, accepter ou refuser l’invitation avec son lien personnel, sans compte obligatoire. Le lien ne vérifie pas son identité.</p><label className="mt-3 block text-sm font-semibold text-slate-700">Nom de la personne<input value={externalName} onChange={(event) => setExternalName(event.target.value)} required maxLength={120} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>{roleControl}<button type="button" disabled={busy || !externalName.trim()} onClick={() => void createInvitation({ displayName: externalName.trim() })} className="mt-3 min-h-11 rounded-lg bg-[#247f88] px-4 py-2 font-bold text-white disabled:opacity-60">Créer une invitation</button><p className="mt-2 text-xs text-slate-600">Le lien créé est personnel : il n’est ni public, ni collectif, ni destiné à être partagé librement.</p>
  </section>;

  return <details id={contextual ? undefined : "add-participant"} data-boussole-id={contextual ? undefined : "add-journey-participants"} open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className={`${contextual ? "mt-2" : "mt-4"} rounded-lg border border-[#247f88]/40 bg-white p-4`}><summary aria-expanded={open} aria-controls={panelId} className="min-h-11 cursor-pointer py-2 font-bold text-[#176b73] outline-none focus-visible:ring-2 focus-visible:ring-cyan-700">{contextual ? "Choisir une personne" : "Ajouter des participants"}</summary><div id={panelId}>
    {initialParticipantRole ? <p className="mt-2 rounded-lg bg-cyan-50 p-3 text-sm font-semibold text-cyan-950">{legacyRoleContext ? "Participation prévue" : `Rôle à pourvoir : ${initialParticipantRole}`}</p> : null}
    {expectedRoleId ? <section aria-labelledby={`${panelId}-self-title`} className="mt-4 rounded-lg border bg-slate-50 p-4"><h4 id={`${panelId}-self-title`} className="font-bold text-slate-950">1. Moi-même</h4><p className="mt-1 text-sm text-slate-600">Affectez-vous directement à ce rôle, sans invitation ni consentement.</p><form action={assignCurrentUserToExpectedRoleAction} className="mt-3"><input type="hidden" name="formTemplateId" value={formTemplateId} /><input type="hidden" name="expectedRoleId" value={expectedRoleId} /><button className="min-h-11 rounded-lg bg-[#247f88] px-4 py-2 font-bold text-white">M’affecter à ce rôle</button></form></section> : null}
    {expectedRoleId && governedJourneyId ? <section aria-labelledby={`${panelId}-participants-title`} className="mt-4 rounded-lg border bg-slate-50 p-4"><h4 id={`${panelId}-participants-title`} className="font-bold text-slate-950">2. Participants du parcours</h4>{journeyParticipants.length === 0 ? <p className="mt-2 text-sm text-slate-600">Aucun autre participant actif n’est disponible.</p> : <ul className="mt-3 divide-y rounded-lg border bg-white">{journeyParticipants.map((participant) => <li key={participant.invitationId} className="p-3"><p className="font-semibold text-slate-950">{participant.displayName}</p><p className="text-sm text-slate-600">Participation acceptée{participant.identified ? "" : " · Identité déclarée, non vérifiée"}</p><form action={assignJourneyParticipantToExpectedRoleAction} className="mt-2"><input type="hidden" name="governedJourneyId" value={governedJourneyId} /><input type="hidden" name="expectedRoleId" value={expectedRoleId} /><input type="hidden" name="invitationId" value={participant.invitationId} /><button className="min-h-11 text-sm font-bold text-[#176b73] underline">Affecter à ce rôle</button></form></li>)}</ul>}</section> : null}
    {!contextual ? <div role="tablist" aria-label="Mode d’ajout de participants" onKeyDown={moveTab} className="mt-4 flex flex-wrap gap-2">{modes.map((value) => <button key={value} id={`${panelId}-${value.toLowerCase()}-tab`} data-mode={value} type="button" role="tab" aria-selected={mode === value} aria-controls={`${panelId}-${value === "DIRECT" ? "direct" : value.toLowerCase()}`} onClick={() => { setMode(value); setConfirming(false); }} className={`min-h-11 rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 ${mode === value ? "bg-slate-900 text-white" : "bg-white text-slate-800"}`}>{value === "DIRECTORY" ? "Annuaire" : value === "MATCHING" ? "Matching" : "Invitation directe"}</button>)}</div> : null}
    {(contextual || mode === "DIRECTORY") ? directorySection : null}
    {!contextual && mode === "MATCHING" ? <section id={`${panelId}-matching`} role="tabpanel" aria-labelledby={`${panelId}-matching-tab`} data-boussole-id="journey-participant-matching" className="mt-4 rounded-lg border bg-slate-50 p-4"><h4 className="font-bold text-slate-950">Matching</h4>
      {matchingContexts.length === 0 ? <><p className="mt-2 text-sm text-slate-700">Aucun Matching disponible pour le moment.</p><p className="mt-2 text-xs text-slate-600">Aucune identité personnelle n’est déduite automatiquement.</p></> : <>
        {relatedMatchingRuns.length ? <div className="mt-3"><h5 className="font-bold text-slate-950">Matchings liés à ce Parcours</h5><ul className="mt-2 space-y-2">{relatedMatchingRuns.map((context) => <li key={context.runId}><button type="button" aria-pressed={selectedMatchingRunId === context.runId} onClick={() => setSelectedMatchingRunId(context.runId)} className={`min-h-11 w-full rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 ${selectedMatchingRunId === context.runId ? "border-[#247f88] bg-cyan-50" : "bg-white"}`}><span className="block font-semibold text-slate-950">{context.sourceLinkTitle}</span><span className="mt-1 block text-xs text-slate-600">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(context.completedAt ?? context.createdAt))} · {context.resultCount} résultat{context.resultCount > 1 ? "s" : ""}</span><span className="mt-2 inline-block rounded-full bg-cyan-100 px-2 py-1 text-xs font-bold text-cyan-900">Lié à ce Parcours</span></button></li>)}</ul></div> : <p className="mt-3 text-sm font-semibold text-slate-800">Aucun Matching n’est actuellement lié à ce Parcours.</p>}
        {otherMatchingRuns.length ? <details className="mt-4 rounded-lg border bg-white"><summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-slate-800">Autres Matchings disponibles ({otherMatchingRuns.length})</summary><div className="border-t p-3"><p className="text-sm text-slate-600">Ces Matchings proviennent d’autres Liens. Vous pouvez les consulter, mais ils ne sont pas liés directement à ce Parcours.</p><ul className="mt-3 space-y-2">{otherMatchingRuns.map((context) => <li key={context.runId}><button type="button" aria-pressed={selectedMatchingRunId === context.runId} onClick={() => setSelectedMatchingRunId(context.runId)} className={`min-h-11 w-full rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 ${selectedMatchingRunId === context.runId ? "border-[#247f88] bg-cyan-50" : "bg-slate-50"}`}><span className="block font-semibold text-slate-950">{context.sourceLinkTitle}</span><span className="mt-1 block text-xs text-slate-600">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(context.completedAt ?? context.createdAt))} · {context.resultCount} résultat{context.resultCount > 1 ? "s" : ""}</span></button></li>)}</ul></div></details> : null}
        {selectedMatching ? <div className="mt-4 rounded-lg border bg-white p-4"><p className="text-sm font-semibold text-[#176b73]">Matching du lien</p><h5 className="mt-1 text-lg font-bold text-slate-950">« {selectedMatching.sourceLinkTitle} »</h5>{selectedMatching.belongsToCurrentJourney ? <span className="mt-2 inline-block rounded-full bg-cyan-100 px-2 py-1 text-xs font-bold text-cyan-900">Lié à ce Parcours</span> : null}<p className="mt-2 text-sm text-slate-700">Exécuté le {matchingDate} · {selectedMatching.resultCount} résultat{selectedMatching.resultCount > 1 ? "s" : ""}</p><a href={selectedMatching.sourceLinkHref} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#176b73] underline">Voir le lien source<span className="sr-only"> (nouvel onglet)</span></a>
          <h5 className="mt-5 font-bold text-slate-950">Résultats</h5><ol className="mt-2 space-y-3">{selectedMatching.results.map((result) => <li key={result.targetLinkId} className="rounded-lg border p-3"><p className="font-semibold text-slate-950">{result.targetLinkTitle}</p><p className="mt-1 text-xs text-slate-600">Résultat du lien « {selectedMatching.sourceLinkTitle} »</p>{result.explanation.length ? <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-[#176b73]">Pourquoi ce résultat ?</summary><ul className="list-disc space-y-1 pl-5">{result.explanation.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}<p className="mt-2 text-sm font-bold text-amber-800">Non invitable directement</p><p className="mt-1 text-xs text-slate-600">{result.nonInvitableReason}</p><a href={result.targetLinkHref} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#176b73] underline">Voir le lien résultat<span className="sr-only"> (nouvel onglet)</span></a></li>)}</ol>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Aucun de ces résultats ne correspond actuellement à une personne Goodissima pouvant être invitée directement. Les résultats ciblent des Liens ou des Opportunités. Aucune identité personnelle n’est déduite automatiquement.</p></div> : null}
      </>}
    </section> : null}
    {(contextual || mode === "DIRECT") ? directSection : null}
    {link ? <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3"><p className="mb-2 text-sm font-semibold text-emerald-950">Ce lien personnel est destiné uniquement à cette invitation.</p><input ref={linkRef} readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Lien personnel d’invitation" className="w-full rounded border bg-white px-3 py-2 text-sm" /><button type="button" onClick={() => void copy(link, linkRef.current)} className="mt-2 min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white">Copier le lien personnel</button></div> : null}
    {message ? <p role="status" className="mt-3 text-sm font-semibold text-slate-700">{message}</p> : null}
  </div></details>;
}
