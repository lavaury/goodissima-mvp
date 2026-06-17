"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { validateTemplateDraftQuality } from "@/lib/ai/template-draft-quality";
import { candidateFieldsFromTemplateDraft, checkCandidatePublicationSafety } from "@/lib/candidate-form-safety";
import { draftPreviewHref } from "@/lib/opportunity-preview";
import { type ProposalChangeSet } from "@/lib/ai/opportunity-refinement";
import { VoiceCaptureButton } from "@/components/VoiceCaptureButton";
import { VOICE_STATUS_LABELS, mergeVoiceTranscript, type VoiceAuditInput } from "@/lib/voice-opportunity";

type Draft = {
  name: string;
  description: string;
  actors: Array<{ name: string; role: string }>;
  stages: Array<{ name: string; objective: string; expectedAction?: string; responsibleActor?: string; deadline?: string; exitCondition?: string }>;
  documents: Array<{ name: string; required: boolean; stage: number }>;
  relationalRequests: Array<{ title: string; description: string; stage: number; targetActor?: string; deadline?: string }>;
  kpis: Array<{ name: string; description: string; unit: string }>;
  fields: Array<Record<string, unknown>>;
};

type QualityIssue = {
  code: string;
  severity: "critical" | "warning";
  message: string;
  path?: string;
};

type QualityValidation = {
  valid: boolean;
  errors: QualityIssue[];
  warnings: QualityIssue[];
};

type CandidateFormSafety = {
  publishable: boolean;
  statusLabel: "Prêt à publier" | "Correction requise";
  error: string | null;
};

async function apiError(response: Response) {
  try {
    const body = await response.json();
    return typeof body.error === "string" ? body.error : "Erreur lors de l'action";
  } catch {
    return "Erreur lors de l'action";
  }
}

function DraftList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

export function AITemplateDesigner() {
  const router = useRouter();
  const toast = useToast();
  const [description, setDescription] = useState("");
  const [generationVoice, setGenerationVoice] = useState<{ transcript: string; capturedAt: string } | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [provenance, setProvenance] = useState<{ provider: string; model: string; promptVersion: string; language: "fr"; generatedAt: string } | null>(null);
  const [validation, setValidation] = useState<QualityValidation | null>(null);
  const [candidateFormSafety, setCandidateFormSafety] = useState<CandidateFormSafety | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState<"generate" | "revise" | "validate" | null>(null);
  const [proposalHistory, setProposalHistory] = useState<Array<{ generationId: string; version: number; draft: Draft; provenance: NonNullable<typeof provenance>; validation: QualityValidation; candidateFormSafety: CandidateFormSafety; feedback?: string; changes: ProposalChangeSet; voiceTranscript?: string; voiceCapturedAt?: string }>>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [pendingRevision, setPendingRevision] = useState<{ feedback: string; inputMode: "text" | "voice"; transcript?: string; capturedAt: string } | null>(null);
  const [aiInstructions, setAiInstructions] = useState("");

  function updateDraft(nextDraft: Draft) {
    setDraft(nextDraft);
    setConfirmed(false);
    if (provenance) setValidation(validateTemplateDraftQuality({ draft: nextDraft, provenance }));
    setCandidateFormSafety(checkCandidatePublicationSafety(candidateFieldsFromTemplateDraft(nextDraft)));
  }

  async function generate() {
    setLoading("generate");
    setConfirmed(false);
    const response = await fetch("/api/templates/ai-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        voiceAudit: generationVoice ? { mode: "generation", transcript: generationVoice.transcript, capturedAt: generationVoice.capturedAt, proposalVersion: 1 } satisfies VoiceAuditInput : undefined,
      }),
    });
    setLoading(null);
    if (!response.ok) return toast.error(await apiError(response));
    const body = await response.json();
    setGenerationId(body.generationId);
    setDraft(body.draft);
    setProvenance(body.provenance);
    setValidation(body.validation);
    setCandidateFormSafety(body.candidateFormSafety);
    setProposalHistory([{ generationId: body.generationId, version: 1, draft: body.draft, provenance: body.provenance, validation: body.validation, candidateFormSafety: body.candidateFormSafety, changes: { added: [], modified: [], removed: [] }, voiceTranscript: generationVoice?.transcript, voiceCapturedAt: generationVoice?.capturedAt }]);
    setActiveVersionIndex(0);
    toast.success("Brouillon IA généré. Aucune publication n'a été effectuée.");
  }

  function prepareRevision(inputMode: "text" | "voice", transcript?: string, capturedAt = new Date().toISOString()) {
    const requestedFeedback = (transcript ?? feedback).trim();
    if (requestedFeedback.length < 3) return;
    setFeedback(requestedFeedback);
    setPendingRevision({ feedback: requestedFeedback, inputMode, transcript: inputMode === "voice" ? requestedFeedback : undefined, capturedAt });
  }

  function prepareVoiceRevision(transcript: string, capturedAt: string) {
    const mergedFeedback = mergeVoiceTranscript(feedback, transcript);
    setFeedback(mergedFeedback);
    setPendingRevision({ feedback: mergedFeedback, inputMode: "voice", transcript: transcript.trim(), capturedAt });
  }

  async function revise() {
    if (!generationId || !draft || !pendingRevision) return;
    setLoading("revise");
    setConfirmed(false);
    const nextVersion = proposalHistory.length + 1;
    const response = await fetch(`/api/templates/ai-generate/${generationId}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback: pendingRevision.feedback,
        currentDraft: draft,
        proposalVersion: nextVersion,
        voiceAudit: pendingRevision.inputMode === "voice" ? { mode: "refinement", transcript: pendingRevision.transcript ?? pendingRevision.feedback, capturedAt: pendingRevision.capturedAt, confirmedAt: new Date().toISOString(), proposalVersion: nextVersion, sourceGenerationId: generationId } satisfies VoiceAuditInput : undefined,
      }),
    });
    setLoading(null);
    if (!response.ok) return toast.error(await apiError(response));
    const body = await response.json();
    const next = { generationId: body.generationId, version: body.proposalVersion, draft: body.draft, provenance: body.provenance, validation: body.validation, candidateFormSafety: body.candidateFormSafety as CandidateFormSafety, feedback: pendingRevision.feedback, changes: body.changes as ProposalChangeSet, voiceTranscript: pendingRevision.transcript, voiceCapturedAt: pendingRevision.inputMode === "voice" ? pendingRevision.capturedAt : undefined };
    setProposalHistory((history) => [...history, next]);
    setActiveVersionIndex(proposalHistory.length);
    setGenerationId(next.generationId);
    setDraft(next.draft);
    setProvenance(next.provenance);
    setValidation(next.validation);
    setCandidateFormSafety(next.candidateFormSafety);
    setFeedback("");
    setPendingRevision(null);
    toast.success(`Proposition v${next.version} créée. La version précédente reste disponible.`);
  }

  function selectVersion(index: number) {
    const selected = proposalHistory[index];
    if (!selected) return;
    setActiveVersionIndex(index);
    setGenerationId(selected.generationId);
    setDraft(selected.draft);
    setProvenance(selected.provenance);
    setValidation(selected.validation);
    setCandidateFormSafety(selected.candidateFormSafety);
    setConfirmed(false);
  }

  async function validate() {
    if (!generationId || !draft || !confirmed) return;
    setLoading("validate");
    const response = await fetch(`/api/templates/ai-generate/${generationId}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanValidated: true, draft, aiInstructions }),
    });
    setLoading(null);
    if (!response.ok) {
      try {
        const body = await response.json();
        if (body.validation) setValidation(body.validation);
        if (body.candidateFormSafety) setCandidateFormSafety(body.candidateFormSafety);
        toast.error(typeof body.error === "string" ? body.error : "Erreur lors de la validation");
      } catch {
        toast.error("Erreur lors de la validation");
      }
      return;
    }
    const body = await response.json();
    toast.success("Parcours créé en brouillon v1.");
    router.push(draftPreviewHref(body.templateId, "studio"));
    router.refresh();
  }

  return (
    <section id="ai-assistant" className="mt-6 rounded-2xl border border-violet-200 bg-white p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">IA Template Designer</p>
        <h2 className="mt-1 text-lg font-semibold">Décrire un parcours en langage naturel</h2>
        <p className="mt-1 text-sm text-slate-500">La génération produit uniquement une proposition en français. Elle ne publie rien et n'exécute aucun workflow.</p>
      </div>
      <textarea
        className="mt-4 min-h-28 w-full rounded-xl border px-4 py-3"
        placeholder="Exemple : créer un parcours d'accueil de nouveaux partenaires avec collecte des justificatifs, validation humaine et indicateurs de délai..."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <VoiceCaptureButton label="Décrire à voix haute" disabled={loading !== null} onTranscript={(transcript, capturedAt) => { setGenerationVoice({ transcript, capturedAt }); setDescription((current) => mergeVoiceTranscript(current, transcript)); }} />
        {generationVoice ? <div className="min-w-0 flex-1 rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm"><p className="font-semibold text-violet-950">Transcription originale</p><p className="mt-1 text-violet-900">{generationVoice.transcript}</p><p className="mt-2 text-xs text-violet-700">Le champ ci-dessus reste modifiable avant génération.</p></div> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-live="polite">
        <span className={`rounded-full px-3 py-1 font-semibold ${generationVoice ? "bg-cyan-50 text-cyan-800" : "bg-slate-100 text-slate-500"}`}>{generationVoice ? VOICE_STATUS_LABELS.transcribing : VOICE_STATUS_LABELS.idle}</span>
        {loading ? <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">{VOICE_STATUS_LABELS.analysis}</span> : null}
        {draft && !loading ? <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">{VOICE_STATUS_LABELS.ready}</span> : null}
      </div>
      <label className="mt-4 block text-sm font-semibold text-slate-800">Comportement attendu de l'assistant IA<textarea value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border px-4 py-3 font-normal" placeholder="Exemple : signaler les documents manquants, proposer les prochaines étapes, ne prendre aucune décision..." /><span className="mt-1 block text-xs font-normal text-slate-500">Définissez ce que l'assistant peut vérifier, signaler ou proposer. Il ne prendra aucune décision à votre place.</span></label>
      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading !== null || description.trim().length < 20}
        className="mt-3 rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading === "generate" ? "Génération..." : "Générer un brouillon"}
      </button>

      {draft ? (
        <div className="mt-6 border-t pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-violet-900">Proposition v{proposalHistory[activeVersionIndex]?.version ?? 1}</p>{activeVersionIndex > 0 ? <ProposalDiff changes={proposalHistory[activeVersionIndex].changes} /> : <p className="text-xs text-slate-500">Première proposition générée.</p>}{proposalHistory[activeVersionIndex]?.voiceTranscript ? <p className="mt-2 text-xs text-slate-500">Révision vocale : « {proposalHistory[activeVersionIndex].voiceTranscript} » · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(proposalHistory[activeVersionIndex].voiceCapturedAt!))}</p> : null}</div>{activeVersionIndex > 0 ? <button type="button" onClick={() => selectVersion(activeVersionIndex - 1)} className="rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700">Revenir à la version précédente</button> : null}</div>
          {proposalHistory.length > 1 ? <div className="mb-4 flex flex-wrap gap-2" aria-label="Historique des propositions">{proposalHistory.map((version, index) => <button key={version.generationId} type="button" onClick={() => selectVersion(index)} className={`rounded-full px-3 py-1 text-xs font-semibold ${index === activeVersionIndex ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600"}`}>Proposition v{version.version}</button>)}</div> : null}
          <input className="w-full rounded-xl border px-4 py-3 text-lg font-semibold" value={draft.name} onChange={(event) => updateDraft({ ...draft, name: event.target.value })} />
          <textarea className="mt-3 min-h-20 w-full rounded-xl border px-4 py-3 text-sm" value={draft.description} onChange={(event) => updateDraft({ ...draft, description: event.target.value })} />
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <DraftList title="Acteurs" items={draft.actors.map((item) => `${item.name} : ${item.role}`)} />
            <DraftList title="Étapes" items={draft.stages.map((item, index) => `${index + 1}. ${item.name} : ${item.objective}`)} />
            <DraftList title="Documents" items={draft.documents.map((item) => `${item.name} - étape ${item.stage}${item.required ? " - requis" : ""}`)} />
            <DraftList title="Demandes relationnelles" items={draft.relationalRequests.map((item) => `${item.title} : ${item.description}`)} />
            <DraftList title="KPI" items={draft.kpis.map((item) => `${item.name} (${item.unit}) : ${item.description}`)} />
            <DraftList title="Champs proposés" items={draft.fields.map((item) => String(item.label ?? item.key ?? "Champ"))} />
          </div>
          {provenance ? <p className="mt-4 text-xs text-slate-500">Provenance : {provenance.provider} / {provenance.model} / {provenance.promptVersion}</p> : null}
          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <label className="block text-sm font-semibold text-violet-950">Que souhaitez-vous modifier ou préciser ?<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border bg-white px-4 py-3 font-normal text-slate-900" placeholder="Exemple : Ajoute une étape de vérification des revenus." /></label>
            <p className="mt-2 text-xs text-violet-800">Exemples : Supprime le garant. · Rends la description plus rassurante. · Ajoute la proximité des transports. · Je veux cibler uniquement des candidats déjà certifiés.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"><VoiceCaptureButton label="Modifier par la voix" disabled={loading !== null} onTranscript={prepareVoiceRevision} /><button type="button" onClick={() => prepareRevision("text")} disabled={loading !== null || feedback.trim().length < 3} className="min-h-11 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Préparer la révision</button></div>
            {pendingRevision ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4" role="alert"><p className="font-semibold text-amber-950">Voici ce que je vais modifier.</p>{pendingRevision.inputMode === "voice" ? <p className="mt-2 text-xs font-semibold text-amber-900">Transcription originale : « {pendingRevision.transcript} »</p> : null}<label className="mt-3 block text-sm font-medium text-amber-950">Instruction modifiable<textarea value={pendingRevision.feedback} onChange={(event) => { setPendingRevision({ ...pendingRevision, feedback: event.target.value }); setFeedback(event.target.value); }} className="mt-1 min-h-20 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 font-normal text-slate-900" /></label><p className="mt-2 text-xs text-amber-800">La proposition actuelle sera révisée en v{proposalHistory.length + 1}. Aucun changement ne sera appliqué avant confirmation.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void revise()} disabled={loading !== null || pendingRevision.feedback.trim().length < 3} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading === "revise" ? "Analyse..." : "Confirmer"}</button><button type="button" onClick={() => setPendingRevision(null)} disabled={loading !== null} className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900">Annuler</button></div></div> : null}
            <p className="mt-2 text-xs text-slate-500">La révision crée une nouvelle proposition. Elle ne publie rien et ne contacte personne.</p>
          </div>
          {validation ? (
            <div className="mt-4 space-y-3" aria-live="polite">
              {validation.errors.length > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-900">Erreurs critiques à corriger</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-800">
                    {validation.errors.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}
                  </ul>
                </div>
              ) : null}
              {validation.warnings.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Points d'attention avant validation humaine</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-800">
                    {validation.warnings.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}
                  </ul>
                </div>
              ) : null}
              {validation.errors.length === 0 && validation.warnings.length === 0 ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Le brouillon satisfait les contrôles de qualité.</p>
              ) : null}
            </div>
          ) : null}
          {candidateFormSafety ? (
            <div className={`mt-4 rounded-xl border p-4 ${candidateFormSafety.publishable ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`} aria-live="polite">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${candidateFormSafety.publishable ? "bg-white text-emerald-800 ring-emerald-200" : "bg-white text-red-800 ring-red-200"}`}>
                {candidateFormSafety.statusLabel}
              </span>
              {candidateFormSafety.error ? <p className="mt-2 text-sm text-red-800">{candidateFormSafety.error}</p> : null}
            </div>
          ) : null}
          <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <input type="checkbox" className="mt-0.5" checked={confirmed} disabled={Boolean(validation && !validation.valid) || Boolean(candidateFormSafety && !candidateFormSafety.publishable)} onChange={(event) => setConfirmed(event.target.checked)} />
            J'ai relu cette proposition et je valide sa création comme brouillon non publié.
          </label>
          <button type="button" onClick={() => void validate()} disabled={!confirmed || loading !== null || Boolean(validation && !validation.valid) || Boolean(candidateFormSafety && !candidateFormSafety.publishable)} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {loading === "validate" ? "Création..." : `Valider cette version (v${proposalHistory[activeVersionIndex]?.version ?? 1})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ProposalDiff({ changes }: { changes: ProposalChangeSet }) {
  return <div className="mt-2 grid gap-1 text-xs"><p className="text-emerald-700"><strong>Ajouté :</strong> {changes.added.join(", ") || "rien"}</p><p className="text-blue-700"><strong>Modifié :</strong> {changes.modified.join(", ") || "rien"}</p><p className="text-red-700"><strong>Supprimé :</strong> {changes.removed.join(", ") || "rien"}</p></div>;
}
