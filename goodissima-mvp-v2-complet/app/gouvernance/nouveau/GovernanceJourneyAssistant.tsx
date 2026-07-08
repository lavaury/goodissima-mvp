"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createGovernedJourneyAction,
  proposeGovernedJourneyAction,
type GovernanceJourneyProposal,
} from "@/lib/governance-journey-actions";

type GenerationProvenance = {
  provider: string;
  model: string;
  promptVersion: string;
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
      />
    </label>
  );
}

export function GovernanceJourneyAssistant() {
  const [need, setNeed] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
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
    formData.set("aiNeed", need);
    formData.set("workspaceId", workspaceId);

    startTransition(async () => {
      try {
        const response = await fetch("/api/gouvernance/journey-ai-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: need, workspaceId }),
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
    formData.set("name", name);
    formData.set("initialNeed", need);
    formData.set("objective", objective);
    formData.set("workspaceId", workspaceId || proposal.workspaceId);
    formData.set("workspaceName", proposal.workspaceName);
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
      await createGovernedJourneyAction(formData);
    });
  }

  return (
    <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-cyan-800">Creer avec l'assistance IA</p>
        <h2 className="text-2xl font-bold text-cyan-950">Besoin exprime, cadrage propose, validation humaine</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-cyan-900">
          L'assistance prepare une proposition a partir de votre saisie libre. Rien n'est cree avant votre validation.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <TextAreaField label="Besoin libre" value={need} onChange={setNeed} minRows={6} />
        <label className="block text-sm font-semibold text-slate-800">
          Workspace cible
          <input
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            maxLength={120}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Optionnel en V1"
          />
          <span className="mt-2 block text-xs font-normal text-cyan-900">
            Le rattachement Workspace reste conserve en metadata tant que le schema V1 ne porte pas ce lien.
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generateProposal}
          disabled={!canGenerate}
          className="rounded-lg bg-cyan-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {isPending && !proposal ? "Generation..." : "Generer une proposition"}
        </button>
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>

      {proposal ? (
        <div className="mt-6 rounded-lg border border-cyan-200 bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Proposition a valider</p>
            <p className="mt-1 text-sm text-slate-600">{proposal.rationale}</p>
            {provenance ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Provenance : {provenance.provider} / {provenance.model} / {provenance.promptVersion}
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
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
              />
            </label>
            <TextAreaField label="Objectif" value={objective} onChange={setObjective} minRows={4} />
            <TextAreaField label="Participants pressentis" value={participants} onChange={setParticipants} />
            <TextAreaField label="Documents attendus" value={documents} onChange={setDocuments} />
            <TextAreaField label="Regles de confidentialite" value={confidentialityRules} onChange={setConfidentialityRules} />
            <TextAreaField label="Premieres actions" value={firstActions} onChange={setFirstActions} />
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {documentNames.length} document{documentNames.length > 1 ? "s" : ""} seront transformes en champs de suivi. Les autres
            elements seront conserves dans la preparation du parcours.
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
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
