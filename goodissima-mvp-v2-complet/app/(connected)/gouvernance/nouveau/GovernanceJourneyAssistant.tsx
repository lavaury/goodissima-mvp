"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { consumeHomeIntentPrefill } from "@/lib/home-intent-prefill";
import {
  createGovernedJourneyAction,
  proposeGovernedJourneyAction,
type GovernanceJourneyProposal,
} from "@/lib/governance-journey-actions";

type GenerationProvenance = {
  capability: string;
  provider: string;
  deployment: string;
  model: string;
  promptVersion: string;
  classification: string;
  generatedAt: string;
};

type GovernanceJourneyAIResponse = {
  requiresHumanValidation: true;
  provenance: GenerationProvenance;
  proposal: GovernanceJourneyProposal;
};

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(values: string[]) {
  return values.join("\n");
}

function TextAreaField({
  label,
  value,
  onChange,
  minRows = 3,
  boussoleId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  boussoleId?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      <textarea
        data-boussole-id={boussoleId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
      />
    </label>
  );
}

export function GovernanceJourneyAssistant({ initialWorkspaceId = "", contextWorkspaceName, requestKey }: { initialWorkspaceId?: string; contextWorkspaceName?: string; requestKey: string }) {
  const [need, setNeed] = useState("");
  const workspaceId = initialWorkspaceId;
  const [proposal, setProposal] = useState<GovernanceJourneyProposal | null>(null);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [participants, setParticipants] = useState("");
  const [documents, setDocuments] = useState("");
  const [confidentialityRules, setConfidentialityRules] = useState("");
  const [firstActions, setFirstActions] = useState("");
  const [provenance, setProvenance] = useState<GenerationProvenance | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => { const prefill = consumeHomeIntentPrefill("CREATE_GOVERNED_JOURNEY"); if (prefill) setNeed(prefill); }, []);

  const canGenerate = need.trim().length >= 10 && !isPending;
  const canCreate = Boolean(proposal && name.trim() && objective.trim() && need.trim()) && !isPending;
  const documentNames = useMemo(() => lines(documents), [documents]);

  function applyProposal(nextProposal: GovernanceJourneyProposal, nextProvenance: GenerationProvenance | null, fallback: boolean) {
    setProposal(nextProposal);
    setProvenance(nextProvenance);
    setUsedFallback(fallback);
    setName(nextProposal.name);
    setObjective(nextProposal.objective);
    setParticipants(joinLines(nextProposal.participants.map((participant) => `${participant.name} - ${participant.role}`)));
    setDocuments(joinLines(nextProposal.documents.map((document) => document.name)));
    setConfidentialityRules(joinLines(nextProposal.confidentialityRules));
    setFirstActions(joinLines(nextProposal.firstActions.map((action) => action.title)));
  }

  function generateProposal() {
    setError("");
    const formData = new FormData();
    formData.set("requestKey", requestKey);
    formData.set("aiNeed", need);
    if (workspaceId) formData.set("workspaceId", workspaceId);

    startTransition(async () => {
      try {
        const response = await fetch("/api/gouvernance/journey-ai-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: need, ...(workspaceId ? { workspaceId } : {}) }),
        });
        if (!response.ok) throw new Error("API_IA_UNAVAILABLE");
        const body = (await response.json()) as GovernanceJourneyAIResponse;
        applyProposal(body.proposal, body.provenance, false);
      } catch (caught) {
        try {
          const nextProposal = await proposeGovernedJourneyAction(formData);
          applyProposal(nextProposal, null, true);
          setError("Assistance IA indisponible : proposition de secours generee localement.");
        } catch (fallbackError) {
          setError(fallbackError instanceof Error ? fallbackError.message : "Generation impossible.");
        }
      }
    });
  }

  function validateAndCreate() {
    if (!proposal) return;
    setError("");
    const formData = new FormData();
    formData.set("requestKey", requestKey);
    formData.set("name", name);
    formData.set("initialNeed", need);
    formData.set("objective", objective);
    if (workspaceId) formData.set("workspaceId", workspaceId);
    formData.set("participants", participants);
    formData.set("documents", documents);
    formData.set("confidentialityRules", confidentialityRules);
    formData.set("firstActions", firstActions);
    formData.set("requiresHumanValidation", "true");
    if (provenance) {
      formData.set("aiProvider", provenance.provider);
      formData.set("aiModel", provenance.model);
      formData.set("aiPromptVersion", provenance.promptVersion);
    }

    startTransition(async () => {
      try {
        await createGovernedJourneyAction(formData);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "La création du parcours n'a pas pu être enregistrée.");
      }
    });
  }

  return (
    <section data-boussole-id="governed-journey-ai-assistant" className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-cyan-800">Creer avec l'assistance IA</p>
        <h2 className="text-2xl font-bold text-cyan-950">Besoin exprime, cadrage propose, validation humaine</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-cyan-900">
          L'assistance prepare une proposition a partir de votre saisie libre. Rien n'est cree avant votre validation.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <TextAreaField label="Besoin libre" value={need} onChange={setNeed} minRows={6} boussoleId="governed-journey-ai-need" />
        <div data-boussole-id="governed-journey-ai-workspace" className="rounded-lg border border-cyan-200 bg-white p-4 text-sm">{workspaceId ? `Création dans ${contextWorkspaceName || "ce Workspace"}` : "Ce parcours sera créé sans Workspace."}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-boussole-id="generate-governed-journey-proposal"
          onClick={generateProposal}
          disabled={!canGenerate}
          className="rounded-lg bg-cyan-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {isPending && !proposal ? "Generation..." : "Generer une proposition"}
        </button>
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>

      {proposal ? (
        <div data-boussole-id="governed-journey-proposal" className="mt-6 rounded-lg border border-cyan-200 bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Proposition a valider</p>
            <p className="mt-1 text-sm text-slate-600">{proposal.rationale}</p>
            {provenance ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Proposition IA : {provenance.provider} / {provenance.model} · {provenance.generatedAt}
              </p>
            ) : null}
            {usedFallback ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                Mode secours : cette proposition n'utilise pas le provider IA.
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="block text-sm font-semibold text-slate-800">
              Nom du parcours
              <input
                data-boussole-id="governed-journey-title"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
              />
            </label>
            <TextAreaField label="Objectif" value={objective} onChange={setObjective} minRows={4} boussoleId="governed-journey-objective" />
            <TextAreaField label="Rôles, profils ou responsabilités à prévoir" value={participants} onChange={setParticipants} boussoleId="governed-journey-participants-section" />
            <p className="text-xs text-slate-600">Ces lignes ne désignent pas des personnes identifiées et ne créent aucune invitation.</p>
            <TextAreaField label="Éléments ou documents attendus" value={documents} onChange={setDocuments} boussoleId="governed-journey-documents-section" />
            <TextAreaField label="Principes de confidentialité proposés" value={confidentialityRules} onChange={setConfidentialityRules} boussoleId="governed-journey-confidentiality" />
            <p className="text-xs text-slate-600">Ils décrivent le cadre souhaité ; ils ne remplacent pas les contrôles techniques appliqués par Goodissima.</p>
            <TextAreaField label="Premières étapes envisagées" value={firstActions} onChange={setFirstActions} boussoleId="governed-journey-first-actions" />
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {documentNames.length} élément{documentNames.length > 1 ? "s" : ""} ou document{documentNames.length > 1 ? "s" : ""} seront préparés comme attentes de suivi. Un élément reçu n’est pas automatiquement validé, ni qualifié comme Source ou Fait. Les autres éléments restent dans le plan initial.
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              data-boussole-id="validate-governed-journey"
              onClick={validateAndCreate}
              disabled={!canCreate}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {isPending ? "Creation..." : "Valider et creer le parcours"}
            </button>
            <button
              type="button"
              onClick={() => setProposal(null)}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Reprendre le besoin
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
