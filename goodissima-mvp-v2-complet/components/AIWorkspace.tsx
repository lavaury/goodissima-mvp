"use client";

import { useEffect, useState } from "react";
import { AIDraftAssistantPanel } from "@/components/AIDraftAssistantPanel";
import { AIOrchestratorPanel, AISituationDetails, type AIOrchestratorModule } from "@/components/AIOrchestratorPanel";
import { AIRelationSummaryPanel } from "@/components/AIRelationSummaryPanel";
import { AIRiskSignalsPanel } from "@/components/AIRiskSignalsPanel";
import { AITimelineIntelligencePanel } from "@/components/AITimelineIntelligencePanel";
import { MatchingPanel } from "@/components/MatchingPanel";
import type { DossierSituation } from "@/lib/dossier-situation";
import type { AIDraftType } from "@/lib/ai/types";

const accordions = [
  { id: "details", label: "Informations de situation", icon: "orchestrator" },
  { id: "summary", label: "Résumé IA", icon: "spark" },
  { id: "timeline", label: "Timeline IA", icon: "timeline" },
  { id: "signals", label: "Signaux IA", icon: "shield" },
  { id: "matching", label: "Matching", icon: "match" },
  { id: "drafts", label: "Brouillons IA", icon: "pen" },
] as const;

type WorkspaceTab = (typeof accordions)[number]["id"];

export function AIWorkspace({
  caseId,
  matchingEnabled,
  situation,
  debugMode = false,
}: {
  caseId: string;
  matchingEnabled: boolean;
  situation: DossierSituation;
  debugMode?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("details");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [pendingDraftPrefill, setPendingDraftPrefill] = useState<{ draftType: AIDraftType; instruction: string } | null>(null);

  useEffect(() => {
    if (activeTab !== "drafts" || !pendingDraftPrefill) return;

    window.dispatchEvent(
      new CustomEvent("goodissima:prepare-ai-draft", {
        detail: {
          caseId,
          draftType: pendingDraftPrefill.draftType,
          instruction: pendingDraftPrefill.instruction,
        },
      }),
    );
    setPendingDraftPrefill(null);
  }, [activeTab, caseId, pendingDraftPrefill]);

  function openModule(module: AIOrchestratorModule) {
    setActiveTab(module);
    setAnalysisOpen(true);
  }

  function prepareDraft(draftType: AIDraftType, instruction: string) {
    setPendingDraftPrefill({ draftType, instruction });
    setActiveTab("drafts");
    setAnalysisOpen(true);
  }

  function prepareIdentityRequest() {
    prepareDraft("CLARIFICATION_REQUEST", situation.recommendedDraftInstruction);
  }

  return (
    <section
      data-ai-workspace="true"
      data-premium-surface="ai-workspace"
      className="overflow-hidden rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] shadow-[0_18px_48px_rgba(47,52,55,0.075)] transition-shadow hover:shadow-[0_22px_56px_rgba(47,52,55,0.1)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
    >
      <div className="p-4 sm:p-5">
        <AIOrchestratorPanel
          situation={situation}
          onOpenModule={openModule}
          onPrepareDraft={prepareDraft}
          onRequestCoordinates={prepareIdentityRequest}
          onShowAnalysis={() => setAnalysisOpen((current) => !current)}
          analysisOpen={analysisOpen}
        />
      </div>

      <div id="ai-workspace-analysis" hidden={!analysisOpen} className="border-t border-[#e7e0d6] bg-[#fffcf8]">
        <div className="space-y-2 p-4 sm:p-5" aria-label="Analyse détaillée du dossier">
          {accordions.map((accordion) => {
            const open = activeTab === accordion.id;
            const panelId = `ai-workspace-panel-${accordion.id}`;
            const buttonId = `ai-workspace-accordion-${accordion.id}`;

            return (
              <section key={accordion.id} className="overflow-hidden rounded-2xl border border-[#d6e7e8] bg-white">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setActiveTab(accordion.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2fb8c4]/40"
                  >
                    <span className="flex items-center gap-2">
                      <AIWorkspaceIcon name={accordion.icon} />
                      {accordion.label}
                    </span>
                    <span aria-hidden="true">{open ? "−" : "+"}</span>
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="border-t border-[#e7e0d6] p-4">
                  {accordion.id === "details" ? <AISituationDetails situation={situation} matchingEnabled={matchingEnabled} /> : null}
                  {accordion.id === "summary" ? <AIRelationSummaryPanel caseId={caseId} workspace /> : null}
                  {accordion.id === "timeline" ? <AITimelineIntelligencePanel caseId={caseId} workspace /> : null}
                  {accordion.id === "signals" ? <AIRiskSignalsPanel caseId={caseId} workspace /> : null}
                  {accordion.id === "matching" ? <MatchingPanel caseId={caseId} matchingEnabled={matchingEnabled} workspace debugMode={debugMode} /> : null}
                  {accordion.id === "drafts" ? <AIDraftAssistantPanel caseId={caseId} workspace /> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
function AIWorkspaceIcon({ name }: { name: (typeof accordions)[number]["icon"] }) {
  const common = "h-4 w-4";

  if (name === "orchestrator") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 4v4" />
        <path d="M12 16v4" />
        <path d="M4 12h4" />
        <path d="M16 12h4" />
        <circle cx="12" cy="12" r="4" />
        <path d="M7.8 7.8l-2-2" />
        <path d="M16.2 7.8l2-2" />
        <path d="M7.8 16.2l-2 2" />
        <path d="M16.2 16.2l2 2" />
      </svg>
    );
  }

  if (name === "spark") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
      </svg>
    );
  }

  if (name === "timeline") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 5v14" />
        <path d="M9 7h10" />
        <path d="M9 12h7" />
        <path d="M9 17h10" />
        <path d="M5 7h.01M5 12h.01M5 17h.01" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l7 3v5c0 4.4-2.7 8.1-7 10-4.3-1.9-7-5.6-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-5" />
      </svg>
    );
  }

  if (name === "match") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 8h6a4 4 0 010 8H7" />
        <path d="M17 8h-6a4 4 0 000 8h6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 19l4.5-1 9-9a2.1 2.1 0 00-3-3l-9 9L5 19z" />
      <path d="M13.5 7.5l3 3" />
    </svg>
  );
}
