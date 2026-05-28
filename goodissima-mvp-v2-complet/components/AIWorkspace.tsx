"use client";

import { useState } from "react";
import { AIDraftAssistantPanel } from "@/components/AIDraftAssistantPanel";
import { AIRelationSummaryPanel } from "@/components/AIRelationSummaryPanel";
import { AIRiskSignalsPanel } from "@/components/AIRiskSignalsPanel";
import { AITimelineIntelligencePanel } from "@/components/AITimelineIntelligencePanel";
import { MatchingPanel } from "@/components/MatchingPanel";

const tabs = [
  { id: "summary", label: "Resume IA", icon: "spark" },
  { id: "timeline", label: "Timeline IA", icon: "timeline" },
  { id: "signals", label: "Signaux IA", icon: "shield" },
  { id: "matching", label: "Matching", icon: "match" },
  { id: "drafts", label: "Brouillons IA", icon: "pen" },
] as const;

type WorkspaceTab = (typeof tabs)[number]["id"];

export function AIWorkspace({
  caseId,
  matchingEnabled,
}: {
  caseId: string;
  matchingEnabled: boolean;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("summary");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <section
      data-ai-workspace="true"
      data-premium-surface="ai-workspace"
      className="overflow-hidden rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] shadow-[0_18px_48px_rgba(47,52,55,0.075)] transition-shadow hover:shadow-[0_22px_56px_rgba(47,52,55,0.1)] lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)] lg:min-h-[620px] lg:flex-col"
    >
      <div className="sticky top-0 z-10 border-b border-[#e7e0d6] bg-[#fffcf8]/95 px-4 py-4 backdrop-blur sm:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2fb8c4] shadow-[0_0_0_4px_rgba(47,184,196,0.12)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#247f88]">Goodissima Intelligence</p>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-[#2f3437]">AI Workspace</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#746d66]">
                IA gouvernee, explicable, auditable, sans decision ni contact automatique.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              className="rounded-full border border-[#d6e7e8] bg-white px-3 py-2 text-xs font-medium text-[#2f3437] shadow-sm transition hover:bg-[#e8f8f9] lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls="ai-workspace-drawer"
            >
              {mobileOpen ? "Fermer" : "Ouvrir"}
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-full bg-[#e8f8f9] p-1" role="tablist" aria-label="AI Workspace">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "relative inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/35",
                  activeTab === tab.id
                    ? "bg-white text-[#2f3437] shadow-[0_6px_18px_rgba(47,184,196,0.14)]"
                    : "text-[#5f686b] hover:bg-white/70 hover:text-[#2f3437]",
                ].join(" ")}
              >
                <AIWorkspaceIcon name={tab.icon} />
                {tab.label}
                {activeTab === tab.id ? (
                  <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[#2fb8c4]" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        id="ai-workspace-drawer"
        className={[
          "min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:block",
          mobileOpen ? "block" : "hidden",
        ].join(" ")}
      >
        {activeTab === "summary" ? <AIRelationSummaryPanel caseId={caseId} workspace /> : null}
        {activeTab === "timeline" ? <AITimelineIntelligencePanel caseId={caseId} workspace /> : null}
        {activeTab === "signals" ? <AIRiskSignalsPanel caseId={caseId} workspace /> : null}
        {activeTab === "matching" ? (
          <MatchingPanel caseId={caseId} matchingEnabled={matchingEnabled} workspace />
        ) : null}
        {activeTab === "drafts" ? <AIDraftAssistantPanel caseId={caseId} workspace /> : null}
      </div>
    </section>
  );
}

function AIWorkspaceIcon({ name }: { name: (typeof tabs)[number]["icon"] }) {
  const common = "h-4 w-4";

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
