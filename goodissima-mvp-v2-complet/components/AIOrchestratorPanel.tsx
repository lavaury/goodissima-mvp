"use client";

import type { AIDraftType } from "@/lib/ai/types";
import type { DossierSituation } from "@/lib/dossier-situation";

export type AIOrchestratorModule = "summary" | "timeline" | "signals" | "matching" | "drafts";

export function AIOrchestratorPanel({
  situation,
  onOpenModule,
  onPrepareDraft,
  onRequestCoordinates,
  onShowAnalysis,
  analysisOpen,
}: {
  situation: DossierSituation;
  onOpenModule: (module: AIOrchestratorModule) => void;
  onPrepareDraft: (draftType: AIDraftType, instruction: string) => void;
  onRequestCoordinates?: () => void;
  onShowAnalysis: () => void;
  analysisOpen: boolean;
}) {
  function runPrimaryAction() {
    if (situation.primary.actionType === "IDENTITY_REQUEST") {
      onRequestCoordinates?.();
      return;
    }
    if (situation.primary.actionType === "DOCUMENT_REQUEST") {
      onPrepareDraft("DOCUMENT_REQUEST", situation.recommendedDraftInstruction);
      return;
    }
    if (situation.primary.actionType === "FOLLOW_UP") {
      onPrepareDraft("FOLLOW_UP", situation.recommendedDraftInstruction);
      return;
    }
    window.dispatchEvent(new CustomEvent("goodissima:open-dossier-section", {
      detail: situation.primary.actionType === "GOVERNANCE" ? { section: "governance" } : {},
    }));
  }

  return (
    <section data-ai-orchestrator="true" data-dossier-situation="true" data-boussole-id="case-next-action" className="rounded-2xl border border-[#d6e7e8] bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#247f88]">À faire maintenant</p>
      <h2 className="mt-2 text-lg font-semibold text-[#2f3437]">{situation.primary.title}</h2>
      <p className="mt-2 text-sm text-[#746d66]">{situation.primary.description}</p>

      <details data-boussole-id="case-next-action-why" className="mt-3 text-sm text-[#746d66]">
        <summary className="cursor-pointer font-semibold text-[#2f3437]">Pourquoi ?</summary>
        <p className="mt-2">{situation.primary.reason}</p>
      </details>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {situation.primary.actionType ? (
          <button type="button" onClick={runPrimaryAction} className="rounded-xl bg-[#263846] px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#2f4858] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/40">
            {situation.primary.actionLabel}
          </button>
        ) : null}
      </div>

      <div data-boussole-id="case-next-action-follow-ups" className="mt-4 border-t border-[#e7e0d6] pt-4">
        {situation.followUps.length > 0 ? (<>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#766f68]">À suivre</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#746d66]">
            {situation.followUps.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>) : <p className="text-sm text-[#746d66]">Aucun autre point à suivre.</p>}
      </div>

      <div data-boussole-id="case-next-action-assistance" className="mt-4 border-t border-[#e7e0d6] pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#766f68]">Assistance</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onShowAnalysis}
          aria-expanded={analysisOpen}
          aria-controls="ai-workspace-analysis"
          className="rounded-xl border border-[#d6e7e8] bg-white px-4 py-2 text-xs font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/40"
        >
          {analysisOpen ? "Masquer l’analyse" : "Voir l’analyse"}
        </button>
        <button type="button" onClick={() => onOpenModule("summary")} className="rounded-xl border border-[#d6e7e8] bg-white px-4 py-2 text-xs font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/40">
          Résumer le dossier
        </button>
        </div>
      </div>
    </section>
  );
}

export function AISituationDetails({ situation, matchingEnabled }: { situation: DossierSituation; matchingEnabled: boolean }) {
  return (
    <section className="rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-sm" aria-label="Informations détaillées de situation">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#247f88]">Analyse détaillée</p>
            <h3 className="mt-1 text-lg font-semibold text-[#2f3437]">Informations de situation</h3>
          </div>
          <span className={statusClassName(situation.status)}>
            Statut : {situation.statusDetail}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <SituationMetric label="Demandes ouvertes" value={String(situation.openRelationalRequestsCount)} />
          <SituationMetric label="Identité candidat" value={situation.identityStatus} />
          <SituationMetric label="Actions relationnelles en attente" value={String(situation.pendingRelationshipActionsCount)} />
          <SituationMetric label="Compatibilité relationnelle" value={matchingEnabled ? "Accessible (opt-in actif)" : "Indisponible (opt-in inactif)"} />
        </div>

        <details className="mt-4 rounded-2xl border border-dashed border-[#d6e7e8] bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
          <summary className="cursor-pointer text-sm font-semibold text-[#2f3437] dark:text-slate-100">Pourquoi ce statut ?</summary>
          <p className="mt-2 text-sm text-[#746d66] dark:text-slate-300">{situation.operationalStatus.description}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#2f3437] dark:text-slate-100">
            {situation.operationalStatus.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>

        <details className="mt-4 rounded-2xl border border-dashed border-[#d6e7e8] bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#2f3437]">Pourquoi cette recommandation ?</summary>
          <dl className="mt-3 grid gap-2 text-sm text-[#746d66]">
            <EvidenceItem label="Dernier événement" value={situation.evidence.lastEvent ?? situation.lastActivityEvidence} />
            <EvidenceItem label="Document manquant" value={situation.evidence.missingDocument ?? "Aucun document manquant identifié dans les demandes ouvertes."} />
            <EvidenceItem label="Signal détecté" value={situation.evidence.signalDetected ?? "Aucun blocage explicite détecté dans les données disponibles."} />
            <EvidenceItem label="Demande ouverte" value={situation.evidence.openRequest ?? "Aucune demande ouverte."} />
            <EvidenceItem label="Identité candidat" value={situation.evidence.identity ?? `${situation.identityDisplayName} - ${situation.identityDisplayEmail}`} />
            <EvidenceItem label="Matching" value={situation.evidence.matchingState} />
          </dl>
        </details>
      <div className="mt-4 rounded-2xl border border-dashed border-[#d6e7e8] bg-white p-4 text-xs leading-relaxed text-[#746d66]">
        <p className="font-semibold text-[#2f3437]">Garde-fous conservés</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Aucune décision automatique.</li>
          <li>Aucun message, email ou contact envoyé automatiquement.</li>
          <li>Le matching reste opt-in et pseudonymisé.</li>
          <li>Les actions proposées doivent être validées par un humain.</li>
          <li>Les usages IA restent traçables dans l'audit et l'observabilité existants.</li>
        </ul>
      </div>
    </section>
  );
}

function operationalStatusClassName(level: DossierSituation["operationalStatus"]["level"]) {
  const base = "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1";
  if (level === "UP_TO_DATE") return `${base} bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-700`;
  if (level === "RECOMMENDED_ACTION") return `${base} bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-700`;
  if (level === "NEEDS_ATTENTION") return `${base} bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:ring-orange-700`;
  if (level === "BLOCKED") return `${base} bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:ring-rose-700`;
  return `${base} bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-700`;
}

function operationalStatusDotClassName(level: DossierSituation["operationalStatus"]["level"]) {
  const base = "h-2 w-2 rounded-full";
  if (level === "UP_TO_DATE") return `${base} bg-emerald-500`;
  if (level === "RECOMMENDED_ACTION") return `${base} bg-amber-500`;
  if (level === "NEEDS_ATTENTION") return `${base} bg-orange-500`;
  if (level === "BLOCKED") return `${base} bg-rose-500`;
  return `${base} bg-sky-500`;
}

function OperationalStatusBadge({ situation }: { situation: DossierSituation }) {
  return (
    <span
      className={operationalStatusClassName(situation.operationalStatus.level)}
      aria-label={`Statut du dossier : ${situation.operationalStatus.label}`}
      title={situation.operationalStatus.description}
    >
      <span className={operationalStatusDotClassName(situation.operationalStatus.level)} aria-hidden="true" />
      {situation.operationalStatus.label}
    </span>
  );
}

function statusClassName(status: DossierSituation["status"]) {
  const base = "w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1";
  if (status === "Bloqué") return `${base} bg-rose-50 text-rose-800 ring-rose-200`;
  if (status === "Incomplet") return `${base} bg-amber-50 text-amber-800 ring-amber-200`;
  if (status === "À surveiller") return `${base} bg-orange-50 text-orange-800 ring-orange-200`;
  if (status === "Clôturé") return `${base} bg-slate-100 text-slate-700 ring-slate-200`;
  return `${base} bg-emerald-50 text-emerald-800 ring-emerald-200`;
}

function SituationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#e7e0d6]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#766f68]">{label}</p>
      <p className="mt-1 font-semibold text-[#2f3437]">{value}</p>
    </div>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f0e8] px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#766f68]">{label}</dt>
      <dd className="mt-1 text-[#2f3437]">{value}</dd>
    </div>
  );
}
