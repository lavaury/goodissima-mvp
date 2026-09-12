import { deterministicEmbedding } from "../../ai/embeddings/mock.ts";
import { compareCategory, compareDate, compareDays, compareLocation, comparePrice, compareTime, normalizeMatchText } from "./comparators.ts";
import type { OpportunityComparison, OpportunityMatchBand, StructuredOpportunityMatch, StructuredOpportunityMatchInput } from "./types.ts";

export const OPPORTUNITY_STRUCTURED_ENGINE_VERSION = "opportunity-structured-v1" as const;
export const OPPORTUNITY_COMPARATOR_POLICY_VERSION = "structured-comparators-v1" as const;
export function isStructuredOpportunityAdmissible(value: StructuredOpportunityMatchInput) { return value.status === "ACTIVE" && value.matchingConsent === "EXPLICIT" && value.projection !== null; }
function dot(a: number[], b: number[]) { return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0); }
function semanticText(value: StructuredOpportunityMatchInput) { const criteria = value.projection!; return normalizeMatchText([criteria.subject, criteria.category, ...(criteria.terms ?? [])].filter(Boolean).join(" ")).replace(/baby sitter|garde d enfants/g, "childcare"); }
function semanticSimilarity(a: StructuredOpportunityMatchInput, b: StructuredOpportunityMatchInput) { return Math.max(0, Math.min(1, dot(deterministicEmbedding(semanticText(a)), deterministicEmbedding(semanticText(b))))); }
function subjectComparison(a: StructuredOpportunityMatchInput, b: StructuredOpportunityMatchInput, similarity: number): OpportunityComparison { const exact = normalizeMatchText(a.projection!.subject) === normalizeMatchText(b.projection!.subject); return { criterion: "subject", outcome: exact || similarity >= 0.45 ? "COMPATIBLE" : "UNKNOWN", label: exact ? "Sujet identique" : similarity >= 0.45 ? "Sujets sémantiquement proches" : "Proximité du sujet à examiner" }; }
function termsComparison(a: StructuredOpportunityMatchInput, b: StructuredOpportunityMatchInput): OpportunityComparison { const left = a.projection!.terms; const right = b.projection!.terms; if (!left?.length || !right?.length) return { criterion: "terms", outcome: "UNKNOWN", label: "Critères complémentaires non comparables" }; const values = new Set(right.map(normalizeMatchText)); return { criterion: "terms", outcome: left.some((value) => values.has(normalizeMatchText(value))) ? "COMPATIBLE" : "UNKNOWN", label: "Critères complémentaires à examiner" }; }
export function opportunityMatchBand(score: number): OpportunityMatchBand { return score >= 80 ? "VERY_GOOD" : score >= 50 ? "GOOD" : "POSSIBLE"; }

export function matchStructuredOpportunity(source: StructuredOpportunityMatchInput, candidate: StructuredOpportunityMatchInput): StructuredOpportunityMatch | null {
  if (!isStructuredOpportunityAdmissible(source) || !isStructuredOpportunityAdmissible(candidate) || source.id === candidate.id || source.ownerId !== candidate.ownerId || source.projection!.opportunityType === candidate.projection!.opportunityType) return null;
  const similarity = semanticSimilarity(source, candidate);
  const left = source.projection!; const right = candidate.projection!;
  const comparisons = [subjectComparison(source, candidate, similarity), compareCategory(left.category, right.category), compareLocation(left.locations, right.locations), compareDays(left.availability, right.availability), compareTime(left.availability, right.availability), compareDate(left.dateWindow, right.dateWindow), comparePrice(left.priceRange, right.priceRange), termsComparison(source, candidate)];
  if (comparisons.some((item) => item.outcome === "INCOMPATIBLE")) return null;
  const compatibleCount = comparisons.filter((item) => item.outcome === "COMPATIBLE").length;
  const internalScore = Math.round(compatibleCount * 15 + similarity * 40);
  const qualitativeBand = opportunityMatchBand(internalScore);
  return { targetGLinkId: candidate.id, internalScore, band: qualitativeBand, explanation: { engine: OPPORTUNITY_STRUCTURED_ENGINE_VERSION, band: qualitativeBand, comparisons, semanticSignals: similarity >= 0.45 ? [`Similarité subject/category/terms : ${similarity.toFixed(3)}`] : [] } };
}
export function rankStructuredOpportunityMatches(source: StructuredOpportunityMatchInput, candidates: StructuredOpportunityMatchInput[]) { return candidates.map((candidate) => matchStructuredOpportunity(source, candidate)).filter((value): value is StructuredOpportunityMatch => value !== null).sort((a, b) => b.internalScore - a.internalScore || a.targetGLinkId.localeCompare(b.targetGLinkId)); }
