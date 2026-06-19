import type { CiroRecord } from "../goodissima-intent-engine/dist/src/ciro/model.js";

export type HousingMatchBand = "EXCELLENT" | "STRONG" | "OPPORTUNITY" | "WEAK" | "NO_MATCH";
export type HousingCandidateFilter = "ALL" | Exclude<HousingMatchBand, "NO_MATCH">;

export type HousingRentalOffer = {
  id: string;
  title: string;
  certificationStatus: "CERTIFIÉE";
  landlordDisplayName: string;
  location: string;
  rent: string;
  surface: string;
  rooms: string;
  availability: string;
  requirements: string[];
  trustCredentials: string[];
  ciro: CiroRecord;
};

export type RankedHousingCandidate = {
  id: string;
  displayName: string;
  summary: string;
  trustCredentials: string[];
  practicalSignals: string[];
  ciro: CiroRecord;
  certificationStatus: "CERTIFIÉ";
  matchScore: number;
  matchStatus: string;
  band: HousingMatchBand;
  bandLabel: string;
  explanations: string[];
  weakCriteria: string[];
  scoreBreakdown: {
    relationshipScore: number;
    roleScore: number;
    trustScore: number;
    familyScore: number;
    totalScore: number;
  };
};

export type HousingRelationRequestDraft = {
  id: string;
  sourceActor: string;
  targetCandidate: string;
  offer: string;
  matchScore: number;
  reasonSummary: string;
  status: "DRAFT" | "PENDING_REVIEW";
};

export function filterHousingCandidates(ranked: RankedHousingCandidate[], filter: HousingCandidateFilter, includeNoMatch = false) {
  return ranked.filter((candidate) => (includeNoMatch || candidate.band !== "NO_MATCH") && (filter === "ALL" || candidate.band === filter));
}

export function createHousingRelationRequestDraft(offer: HousingRentalOffer, candidate: RankedHousingCandidate): HousingRelationRequestDraft {
  if (candidate.band === "NO_MATCH") throw new Error("NO_MATCH_CONTACT_PROHIBITED");
  return {
    id: `draft-${offer.id}-${candidate.id}`,
    sourceActor: offer.landlordDisplayName,
    targetCandidate: candidate.displayName,
    offer: offer.title,
    matchScore: candidate.matchScore,
    reasonSummary: candidate.explanations.slice(0, 3).join(" · "),
    status: "DRAFT",
  };
}

export function getHousingCandidateDebugDetails(candidate: RankedHousingCandidate, debugMode: boolean) {
  return debugMode ? { ciro: candidate.ciro, scoreBreakdown: candidate.scoreBreakdown, engineStatus: candidate.matchStatus } : null;
}
