import type { CiroRecord } from "../ciro/model.js";
import type { MergeScoreStatus } from "../merge/types.js";

export interface PresentationReasonLabels {
  matched: string;
  unmatched: string;
}

export interface FrenchPresentationCatalog {
  version: "1.0";
  locale: "fr";
  labels: Record<string, string> & Record<MergeScoreStatus, string>;
  text: {
    requester: string;
    opportunities: string;
    score: string;
    reasons: string;
  };
  reasons: Record<"relationship" | "role" | "trust" | "family", PresentationReasonLabels>;
}

export interface DemoCiroFixture {
  presentationId: string;
  ciro: CiroRecord;
}

export interface DemoMergeScenario {
  version: "1.0";
  requesterLabel: string;
  requester: DemoCiroFixture;
  candidates: DemoCiroFixture[];
}
