"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { experienceExamples, getFriendlyMergeWording, opportunityLifecycleLabels, transitionOpportunity, transitionRelationshipRequest, trustLevelLabels, type OpportunityLifecycle, type RelationshipRequestStatus } from "@/lib/goodissima-experience";
import type { HousingRentalOffer, RankedHousingCandidate } from "@/lib/housing-candidate-demo-client";
import { draftPreviewHref } from "@/lib/opportunity-preview";
import type { ProposalChangeSet } from "@/lib/ai/opportunity-refinement";

type Draft = {
  name: string;
  description: string;
  actors: Array<{ name: string; role: string }>;
  stages: Array<{ name: string; objective: string; exitCondition?: string }>;
  documents: Array<{ name: string; required: boolean; stage: number }>;
  relationalRequests: Array<{ title: string; description: string }>;
  kpis: Array<{ name: string; description: string; unit: string }>;
  fields: Array<Record<string, unknown>>;
};

type QualityReport = { valid: boolean; errors: Array<{ message: string }>; warnings: Array<{ message: string }> };

export function GoodissimaExperienceJourney({ offer, candidates, workspaceHref }: { offer: HousingRentalOffer; candidates: RankedHousingCandidate[]; workspaceHref: string }) {
  const router = useRouter();
  const [need, setNeed] = useState("");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<OpportunityLifecycle>("DRAFT");
  const [humanValidated, setHumanValidated] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [attachment, setAttachment] = useState("");
  const [verifiedLink, setVerifiedLink] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<RankedHousingCandidate | null>(null);
  const [requestStatus, setRequestStatus] = useState<RelationshipRequestStatus | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalHistory, setProposalHistory] = useState<Array<{ generationId: string; version: number; draft: Draft; quality: QualityReport; changes: ProposalChangeSet }>>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const visibleCandidates = useMemo(() => candidates.filter((candidate) => candidate.band !== "NO_MATCH").slice(0, 8), [candidates]);

  async function generate() {
    setLoading("generate"); setError(null); setHumanValidated(false);
    const response = await fetch("/api/templates/ai-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: need }) });
    setLoading(null);
    if (!response.ok) return setError("Impossible de générer la proposition.");
    const body = await response.json();
    setGenerationId(body.generationId); setDraft(body.draft); setQuality(body.validation); setLifecycle("DRAFT");
    setProposalHistory([{ generationId: body.generationId, version: 1, draft: body.draft, quality: body.validation, changes: { added: [], modified: [], removed: [] } }]);
    setActiveVersionIndex(0);
  }

  async function revise() {
    if (!generationId || !draft || feedback.trim().length < 3) return;
    setLoading("revise"); setError(null); setHumanValidated(false);
    const response = await fetch(`/api/templates/ai-generate/${generationId}/revise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback, currentDraft: draft, proposalVersion: proposalHistory.length + 1 }) });
    setLoading(null);
    if (!response.ok) return setError("Impossible de réviser la proposition actuelle.");
    const body = await response.json();
    const next = { generationId: body.generationId, version: body.proposalVersion, draft: body.draft, quality: body.validation, changes: body.changes as ProposalChangeSet };
    setProposalHistory((history) => [...history, next]); setActiveVersionIndex(proposalHistory.length);
    setGenerationId(next.generationId); setDraft(next.draft); setQuality(next.quality); setFeedback("");
  }

  function selectVersion(index: number) {
    const selected = proposalHistory[index];
    if (!selected) return;
    setActiveVersionIndex(index); setGenerationId(selected.generationId); setDraft(selected.draft); setQuality(selected.quality); setHumanValidated(false);
  }

  async function validate() {
    if (!generationId || !draft || !humanValidated) return;
    setLoading("validate"); setError(null);
    const response = await fetch(`/api/templates/ai-generate/${generationId}/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ humanValidated: true, draft, aiInstructions, presentation: { photos: photoUrl ? [photoUrl] : [], attachments: attachment ? [attachment] : [], verifiedLinks: verifiedLink ? [verifiedLink] : [] } }) });
    setLoading(null);
    if (!response.ok) return setError("La validation humaine n'a pas pu créer le brouillon.");
    const body = await response.json();
    setTemplateId(body.templateId); setLifecycle(transitionOpportunity("DRAFT", "VALIDATED", true));
    router.push(draftPreviewHref(body.templateId, "experience"));
  }

  async function publish() {
    if (!templateId) return;
    setLoading("publish"); setError(null);
    const response = await fetch(`/api/templates/${templateId}/publish`, { method: "POST" });
    setLoading(null);
    if (!response.ok) return setError("La publication explicite a échoué.");
    setLifecycle(transitionOpportunity("VALIDATED", "PUBLISHED", true));
  }

  async function updateLifecycle(next: "SUSPENDED" | "CLOSED" | "PUBLISHED") {
    if (!templateId) return;
    setLoading("lifecycle"); setError(null);
    const response = await fetch(`/api/templates/${templateId}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next, humanConfirmed: true }) });
    setLoading(null);
    if (!response.ok) return setError("Le changement de statut a été refusé.");
    setLifecycle(transitionOpportunity(lifecycle, next, true));
  }

  function prepareRequest(candidate: RankedHousingCandidate) {
    setSelectedCandidate(candidate); setRequestStatus("DRAFT");
  }

  function moveRequest(next: RelationshipRequestStatus) {
    if (!requestStatus) return;
    setRequestStatus(transitionRelationshipRequest(requestStatus, next, true));
  }

  return (
    <div className="mt-8 space-y-8">
      <Phase number="1" title="Créer une opportunité avec assistance IA" subtitle="Décrivez le besoin. L'IA structure une proposition, mais vous gardez la décision.">
        <div className="flex flex-wrap gap-2">{experienceExamples.map((example) => <button key={example} type="button" onClick={() => setNeed(example)} className="rounded-full border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-violet-50">{example}</button>)}</div>
        <textarea value={need} onChange={(event) => setNeed(event.target.value)} className="mt-4 min-h-28 w-full rounded-2xl border px-4 py-3" placeholder="Décrivez votre besoin, les personnes concernées et les critères importants..." />
        <label className="mt-4 block text-sm font-semibold">Comportement attendu de l'assistant IA<textarea value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2 font-normal" placeholder="Ce que l'assistant peut vérifier, signaler ou proposer..." /><span className="mt-1 block text-xs font-normal text-slate-500">Définissez ce que l'assistant peut vérifier, signaler ou proposer. Il ne prendra aucune décision à votre place.</span></label>
        <button type="button" disabled={need.trim().length < 20 || loading !== null} onClick={() => void generate()} className="mt-3 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading === "generate" ? "Structuration..." : "Structurer mon opportunité"}</button>
        {draft ? <><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50 p-4"><div><p className="font-semibold text-violet-900">Proposition v{proposalHistory[activeVersionIndex]?.version ?? 1}</p>{activeVersionIndex > 0 ? <ProposalChanges changes={proposalHistory[activeVersionIndex].changes} /> : <p className="text-xs text-violet-700">Première proposition.</p>}</div>{activeVersionIndex > 0 ? <button type="button" onClick={() => selectVersion(activeVersionIndex - 1)} className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900">Revenir à la version précédente</button> : null}</div><div className="mt-3 flex flex-wrap gap-2">{proposalHistory.map((version, index) => <button key={version.generationId} type="button" onClick={() => selectVersion(index)} className={`rounded-full px-3 py-1 text-xs font-semibold ${index === activeVersionIndex ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600"}`}>Proposition v{version.version}</button>)}</div><div className="mt-5 grid gap-4 lg:grid-cols-3"><Summary title="Personnes concernées" items={draft.actors.map((item) => `${item.name} : ${item.role}`)} /><Summary title="Documents demandés" items={draft.documents.map((item) => `${item.name}${item.required ? " · requis" : ""}`)} /><Summary title="Objectifs de la recherche" items={[...draft.stages.map((item) => item.exitCondition || item.objective), ...draft.kpis.map((item) => `${item.name} · ${item.unit}`)].filter(Boolean)} /></div><div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4"><label className="block text-sm font-semibold text-violet-950">Que souhaitez-vous modifier ou préciser ?<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border bg-white px-3 py-2 font-normal text-slate-900" placeholder="Ajoute une étape de vérification des revenus." /></label><p className="mt-2 text-xs text-violet-800">Exemples : Supprime le garant. · Rends la description plus rassurante. · Ajoute la proximité des transports. · Je veux cibler uniquement des candidats déjà certifiés.</p><button type="button" disabled={feedback.trim().length < 3 || loading !== null} onClick={() => void revise()} className="mt-3 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading === "revise" ? "Révision..." : "Réviser cette proposition"}</button><p className="mt-2 text-xs text-slate-500">Aucune publication ni prise de contact automatique.</p></div></> : null}
        {quality ? <div className={`mt-4 rounded-2xl border p-4 ${quality.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className="font-semibold">Contrôle qualité : {quality.valid ? "prêt pour revue humaine" : "corrections requises"}</p>{quality.warnings.map((item) => <p key={item.message} className="mt-1 text-sm">• {item.message}</p>)}</div> : null}
        {draft ? <><label className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><input type="checkbox" checked={humanValidated} onChange={(event) => setHumanValidated(event.target.checked)} />J'ai relu les acteurs, documents et critères. Je valide humainement la création d'un brouillon non publié.</label><button type="button" disabled={!humanValidated || !quality?.valid || loading !== null} onClick={() => void validate()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading === "validate" ? "Création..." : `Valider cette version (v${proposalHistory[activeVersionIndex]?.version ?? 1})`}</button></> : null}
      </Phase>

      <Phase number="2" title="Valider et publier explicitement" subtitle="La publication, la suspension et la clôture restent des actes humains traçables.">
        <Lifecycle current={lifecycle} />
        <div className="mt-4 grid gap-3 md:grid-cols-3"><MediaField label="Photo" value={photoUrl} onChange={setPhotoUrl} placeholder="URL d'une photo de démonstration" /><MediaField label="Pièce jointe" value={attachment} onChange={setAttachment} placeholder="Nom du document joint" /><MediaField label="Lien vérifié" value={verifiedLink} onChange={setVerifiedLink} placeholder="https://..." /></div>
        <div className="mt-4 flex flex-wrap gap-2">{lifecycle === "VALIDATED" ? <button type="button" onClick={() => void publish()} disabled={loading !== null} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Publier après validation</button> : null}{lifecycle === "PUBLISHED" ? <><button type="button" onClick={() => void updateLifecycle("SUSPENDED")} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800">Suspendre</button><button type="button" onClick={() => void updateLifecycle("CLOSED")} className="rounded-xl border px-4 py-2 text-sm font-semibold">Clôturer</button></> : null}{lifecycle === "SUSPENDED" ? <><button type="button" onClick={() => void updateLifecycle("PUBLISHED")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Republier</button><button type="button" onClick={() => void updateLifecycle("CLOSED")} className="rounded-xl border px-4 py-2 text-sm font-semibold">Clôturer</button></> : null}</div>
        <div className="mt-4 flex flex-wrap gap-2"><TrustBadge label={trustLevelLabels.UNVERIFIED} tone="slate" /><TrustBadge label={trustLevelLabels.VERIFIED} tone="cyan" /><TrustBadge label={trustLevelLabels.CERTIFIED} tone="emerald" /></div>
      </Phase>

      <Phase number="3" title="Découvrir les meilleures correspondances" subtitle="Le moteur de compatibilité existant classe les résultats. Les détails techniques restent réservés au debug.">
        {lifecycle !== "PUBLISHED" && !analysisRequested ? <div className="rounded-2xl border border-dashed p-5"><p className="font-semibold">L'analyse démarre après publication ou sur demande explicite.</p><p className="mt-1 text-sm text-slate-500">Aucun résultat de correspondance n'est affiché avant votre validation.</p><button type="button" disabled={lifecycle !== "VALIDATED"} onClick={() => setAnalysisRequested(true)} className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40">Analyser explicitement le brouillon validé</button></div> : <>
        <div className="flex justify-end"><button type="button" onClick={() => setDebugMode((value) => !value)} className="rounded-full border px-3 py-2 text-xs font-semibold">{debugMode ? "Masquer le debug" : "Afficher le debug"}</button></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{visibleCandidates.map((candidate) => { const wording = getFriendlyMergeWording(candidate); return <article key={candidate.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{candidate.displayName}</h3><p className="mt-1 text-sm text-slate-500">{candidate.summary}</p></div><span className="text-xl font-bold text-violet-800">{candidate.matchScore} %</span></div><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">Points forts</p><ul className="mt-1 text-sm text-slate-700">{wording.strengths.slice(0, 3).map((item) => <li key={item}>✓ {item}</li>)}</ul><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Points d'attention</p><ul className="mt-1 text-sm text-slate-700">{wording.attentionPoints.map((item) => <li key={item}>• {item}</li>)}</ul><button type="button" onClick={() => prepareRequest(candidate)} className="mt-4 rounded-xl bg-[#247f88] px-4 py-2 text-sm font-semibold text-white">Demander une mise en relation</button>{debugMode ? <pre className="mt-3 max-h-52 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] text-slate-100">{JSON.stringify({ ciro: candidate.ciro, score: candidate.scoreBreakdown }, null, 2)}</pre> : null}</article>; })}</div>
        </>}
      </Phase>

      <Phase number="4" title="Initier une relation gouvernée" subtitle="Aucun contact automatique : la demande passe par une revue et une décision humaine.">
        {selectedCandidate && requestStatus ? <div className="rounded-2xl border bg-white p-5"><p className="font-semibold">{offer.landlordDisplayName} → {selectedCandidate.displayName}</p><p className="mt-1 text-sm text-slate-500">Offre : {offer.title} · score {selectedCandidate.matchScore} %</p><p className="mt-3 text-sm">Statut : <strong>{requestStatus}</strong></p><div className="mt-4 flex flex-wrap gap-2">{requestStatus === "DRAFT" ? <button type="button" onClick={() => moveRequest("PENDING_REVIEW")} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Soumettre à la revue</button> : null}{requestStatus === "PENDING_REVIEW" ? <><button type="button" onClick={() => moveRequest("ACCEPTED")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm text-white">Accepter humainement</button><button type="button" onClick={() => moveRequest("DECLINED")} className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700">Décliner</button></> : null}</div></div> : <p className="rounded-2xl border border-dashed p-5 text-sm text-slate-500">Choisissez une correspondance pour préparer une demande.</p>}
      </Phase>

      <Phase number="5–6" title="Collaborer dans l'espace relationnel" subtitle="Après acceptation, Conversation, Documents, Matching, Gouvernance et assistance IA deviennent la zone de travail.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{["Conversation", "Documents", "Matching", "Gouvernance"].map((item) => <div key={item} className="rounded-2xl bg-slate-50 p-4 font-semibold">{item}</div>)}</div>
        <div className="mt-4 rounded-2xl bg-violet-50 p-4"><p className="font-semibold text-violet-900">Assistant relationnel optionnel</p><p className="mt-1 text-sm text-violet-800">Résumé des échanges, prochaines actions, documents manquants, risques et blocages. Aucune décision n'est prise automatiquement.</p></div>
        {requestStatus === "ACCEPTED" ? <Link href={workspaceHref} className="mt-4 inline-flex rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Ouvrir l'espace relationnel</Link> : <p className="mt-4 text-sm text-slate-500">L'espace s'ouvre après acceptation humaine.</p>}
      </Phase>

      <Phase number="7" title="Mesurer les résultats et la valeur" subtitle="Accédez aux indicateurs existants depuis l'opportunité jusqu'aux résultats.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><JourneyLink href="/analytics" label="Conversion" /><JourneyLink href="/demo/housing-candidates" label="Merge" /><JourneyLink href="/templates" label="Templates" /><JourneyLink href="/admin/ai-costs" label="Coûts IA" /><JourneyLink href="/admin/ai-costs" label="Valeur IA" /></div>
      </Phase>
      {error ? <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-700 px-4 py-3 text-sm text-white shadow-xl">{error}</div> : null}
    </div>
  );
}

function Phase({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-700 text-sm font-bold text-white">{number}</span><div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div><div className="mt-5">{children}</div></section>; }
function Summary({ title, items }: { title: string; items: string[] }) { return <div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-semibold">{title}</h3><ul className="mt-2 space-y-1 text-sm text-slate-600">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>; }
function Lifecycle({ current }: { current: OpportunityLifecycle }) { const states: OpportunityLifecycle[] = ["DRAFT", "VALIDATED", "PUBLISHED", "SUSPENDED", "CLOSED"]; return <div className="flex flex-wrap gap-2">{states.map((state) => <span key={state} className={`rounded-full px-3 py-2 text-xs font-semibold ${state === current ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-500"}`}>{opportunityLifecycleLabels[state]}</span>)}</div>; }
function MediaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-sm font-medium">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" placeholder={placeholder} /></label>; }
function TrustBadge({ label, tone }: { label: string; tone: "slate" | "cyan" | "emerald" }) { const classes = tone === "emerald" ? "bg-emerald-50 text-emerald-800" : tone === "cyan" ? "bg-cyan-50 text-cyan-800" : "bg-slate-100 text-slate-700"; return <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${classes}`}>{label}</span>; }
function JourneyLink({ href, label }: { href: string; label: string }) { return <Link href={href} className="rounded-2xl border bg-slate-50 p-4 text-center text-sm font-semibold hover:border-violet-300 hover:bg-violet-50">{label}</Link>; }
function ProposalChanges({ changes }: { changes: ProposalChangeSet }) { return <div className="mt-1 text-xs"><p className="text-emerald-700">Ajouté : {changes.added.join(", ") || "rien"}</p><p className="text-blue-700">Modifié : {changes.modified.join(", ") || "rien"}</p><p className="text-red-700">Supprimé : {changes.removed.join(", ") || "rien"}</p></div>; }
