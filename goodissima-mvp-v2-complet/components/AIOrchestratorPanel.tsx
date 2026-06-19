"use client";

import type { AIDraftType } from "@/lib/ai/types";
import type { DossierSituation } from "@/lib/dossier-situation";

export type AIOrchestratorModule = "summary" | "timeline" | "signals" | "matching" | "drafts";

const orchestrationSteps: Array<{
  id: AIOrchestratorModule;
  title: string;
  purpose: string;
  output: string;
  actionLabel: string;
}> = [
  {
    id: "summary",
    title: "Résumé IA",
    purpose: "Comprendre rapidement le dossier, les points clés, les risques et les documents manquants.",
    output: "Synthèse exploitable avant toute décision humaine.",
    actionLabel: "Ouvrir le résumé",
  },
  {
    id: "timeline",
    title: "Timeline IA",
    purpose: "Repérer les blocages, l'inactivité et les prochaines actions possibles.",
    output: "Lecture chronologique et recommandations de suivi.",
    actionLabel: "Ouvrir la timeline",
  },
  {
    id: "signals",
    title: "Signaux IA",
    purpose: "Mettre en évidence les points de vigilance sans score caché ni décision automatique.",
    output: "Signaux explicables et prise en compte auditée.",
    actionLabel: "Ouvrir les signaux",
  },
  {
    id: "matching",
    title: "Matching",
    purpose: "Identifier des correspondances opt-in, pseudonymisées et explicables.",
    output: "Suggestions relationnelles à confirmer manuellement.",
    actionLabel: "Ouvrir le matching",
  },
  {
    id: "drafts",
    title: "Brouillons IA",
    purpose: "Préparer une réponse, une relance, une clarification ou une demande de document.",
    output: "Texte placé dans l'éditeur uniquement après validation humaine.",
    actionLabel: "Ouvrir les brouillons",
  },
];

export function AIOrchestratorPanel({
  matchingEnabled,
  situation,
  onOpenModule,
  onPrepareDraft,
  onRequestCoordinates,
}: {
  matchingEnabled: boolean;
  situation: DossierSituation;
  onOpenModule: (module: AIOrchestratorModule) => void;
  onPrepareDraft: (draftType: AIDraftType, instruction: string) => void;
  onRequestCoordinates?: () => void;
}) {
  function runRecommendedAction() {
    if (situation.recommendedActionType === "IDENTITY_REQUEST") {
      onRequestCoordinates?.();
      return;
    }
    if (situation.recommendedActionType === "DOCUMENT_REQUEST") {
      onPrepareDraft("DOCUMENT_REQUEST", situation.recommendedDraftInstruction);
      return;
    }
    if (situation.recommendedActionType === "FOLLOW_UP") {
      onPrepareDraft("FOLLOW_UP", situation.recommendedDraftInstruction);
      return;
    }
    if (situation.recommendedActionType === "SIGNALS") {
      onOpenModule("signals");
      return;
    }
    if (situation.recommendedActionType === "TIMELINE") {
      onOpenModule("timeline");
      return;
    }
    onOpenModule("summary");
  }

  return (
    <section data-ai-orchestrator="true" className="h-full">
      <div className="rounded-2xl border border-[#d6e7e8] bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#247f88]">État du dossier</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-[#2f3437]">Situation du dossier</h2>
          <OperationalStatusBadge situation={situation} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#746d66]">
          Résumé de l'état du dossier et actions recommandées.
        </p>
      </div>

      <section className="mt-4 rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-sm" data-dossier-situation="true">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#247f88]">Situation du dossier</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-[#2f3437]">Que dois-je faire maintenant ?</h3>
              <OperationalStatusBadge situation={situation} />
            </div>
          </div>
          <span className={statusClassName(situation.status)}>
            Statut : {situation.statusDetail}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <SituationMetric label="Dernière activité" value={situation.lastActivityLabel} />
          <SituationMetric label="Documents manquants" value={String(situation.missingDocumentsCount)} />
          <SituationMetric label="Demandes ouvertes" value={String(situation.openRelationalRequestsCount)} />
          <SituationMetric label="Blocages détectés" value={String(situation.detectedBlockersCount)} />
          <SituationMetric label="Identité candidat" value={situation.identityStatus} />
          <SituationMetric label="État du dossier" value={situation.operationalStatus.label} />
          <SituationMetric label="Actions relationnelles en attente" value={String(situation.pendingRelationshipActionsCount)} />
          <SituationMetric label="Matching" value={matchingEnabled ? "Activé" : "Non activé"} />
        </div>

        <div className="mt-4 rounded-2xl border border-[#e7e0d6] bg-[#f6f0e8] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#766f68]">Action recommandée</p>
          <p className="mt-2 font-semibold text-[#2f3437]">{situation.recommendedAction}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={runRecommendedAction} className="rounded-xl bg-[#263846] px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#2f4858]">
              Suivre cette recommandation
            </button>
            <button type="button" onClick={() => onPrepareDraft("FOLLOW_UP", situation.recommendedDraftInstruction)} className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-xs font-semibold text-[#2f3437]">
              Préparer une relance
            </button>
            {situation.identityMissing && onRequestCoordinates ? (
              <button type="button" onClick={onRequestCoordinates} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                Demander les coordonnées
              </button>
            ) : null}
            <button type="button" onClick={() => onPrepareDraft("DOCUMENT_REQUEST", situation.recommendedDraftInstruction)} className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-xs font-semibold text-[#2f3437]">
              Demander un document
            </button>
            <button type="button" onClick={() => onOpenModule("summary")} className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-xs font-semibold text-[#2f3437]">
              Préparer un résumé
            </button>
            <button type="button" onClick={() => onOpenModule("signals")} className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-xs font-semibold text-[#2f3437]">
              Voir les signaux
            </button>
            <button type="button" onClick={() => onOpenModule("timeline")} className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-xs font-semibold text-[#2f3437]">
              Voir la timeline
            </button>
          </div>
          <p className="mt-3 text-xs text-[#746d66]">
            Les brouillons sont placés dans l'éditeur de brouillon IA. Aucun message n'est envoyé automatiquement.
          </p>
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
      </section>

      <div className="mt-4 grid gap-3">
        {orchestrationSteps.map((step, index) => {
          const matchingBlocked = step.id === "matching" && !matchingEnabled;

          return (
            <article key={step.id} className="rounded-2xl border border-[#e7e0d6] bg-[#f6f0e8] p-4 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#247f88] ring-1 ring-[#d6e7e8]">
                      Étape {index + 1}
                    </span>
                    {matchingBlocked ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                        Opt-in requis
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        Disponible
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-semibold text-[#2f3437]">{step.title}</h3>
                  <p className="mt-1 text-[#746d66]">{step.purpose}</p>
                  <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-[#5f686b] ring-1 ring-[#e7e0d6]">
                    Sortie attendue : {step.output}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenModule(step.id)}
                  className="shrink-0 rounded-xl bg-[#263846] px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#2f4858]"
                >
                  {step.actionLabel}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-[#d6e7e8] bg-[#fffcf8] p-4 text-xs leading-relaxed text-[#746d66]">
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
