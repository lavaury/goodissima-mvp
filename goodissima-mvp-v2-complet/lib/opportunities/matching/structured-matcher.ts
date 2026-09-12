import { deterministicEmbedding } from "../../ai/embeddings/mock.ts";
import { compareCategory, compareDate, compareDays, compareLocation, comparePrice, compareTime, normalizeMatchText } from "./comparators.ts";
import type { OpportunityComparison, OpportunityMatchBand, StructuredOpportunityMatch, StructuredOpportunityMatchInput } from "./types.ts";

export const OPPORTUNITY_STRUCTURED_ENGINE_VERSION = "opportunity-structured-v1" as const;
export const OPPORTUNITY_COMPARATOR_POLICY_VERSION = "structured-comparators-v1" as const;

export function isStructuredOpportunityAdmissible(value: StructuredOpportunityMatchInput) { return value.status === "ACTIVE" && !value.legacy && !value.structuredMetadataInvalid && (value.type === "OFFER" || value.type === "NEED") && value.criteria !== null; }
function dot(a: number[], b: number[]) { return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0); }
function semanticText(value: StructuredOpportunityMatchInput) { const criteria = value.criteria!; return normalizeMatchText([criteria.subject, criteria.category, ...(criteria.terms ?? [])].filter(Boolean).join(" ")).replace(/baby sitter|garde d enfants/g, "childcare"); }
function semanticSimilarity(a: StructuredOpportunityMatchInput, b: StructuredOpportunityMatchInput) { return Math.max(0, Math.min(1, dot(deterministicEmbedding(semanticText(a)), deterministicEmbedding(semanticText(b))))); }
function subjectComparison(a: StructuredOpportunityMatchInput, b: StructuredOpportunityMatchInput, similarity: number): OpportunityComparison { const exact = normalizeMatchText(a.criteria!.subject) === normalizeMatchText(b.criteria!.subject); return { criterion: "subject", outcome: exact || similarity >= 0.45 ? "COMPATIBLE" : "UNKNOWN", label: exact ? "Sujet identique" : similarity >= 0.45 ? "Sujets sémantiquement proches" : "Proximité du sujet à examiner" }; }
function termsComparison(a: StructuredOpportunityMatchInput, b: StructuredOpportunityMatchInput): OpportunityComparison { const left = a.criteria!.terms; const right = b.criteria!.terms; if (!left?.length || !right?.length) return { criterion: "terms", outcome: "UNKNOWN", label: "Critères complémentaires non comparables" }; const values = new Set(right.map(normalizeMatchText)); return { criterion: "terms", outcome: left.some((value) => values.has(normalizeMatchText(value))) ? "COMPATIBLE" : "UNKNOWN", label: "Critères complémentaires à examiner" }; }
export function opportunityMatchBand(score: number): OpportunityMatchBand { return score >= 80 ? "VERY_GOOD" : score >= 50 ? "GOOD" : "POSSIBLE"; }

export function matchStructuredOpportunity(source: StructuredOpportunityMatchInput, candidate: StructuredOpportunityMatchInput): StructuredOpportunityMatch | null {
  if (!isStructuredOpportunityAdmissible(source) || !isStructuredOpportunityAdmissible(candidate) || source.id === candidate.id || source.ownerId !== candidate.ownerId || source.type === candidate.type) return null;
  const similarity = semanticSimilarity(source, candidate);
  const comparisons = [subjectComparison(source, candidate, similarity), compareCategory(source.criteria!.category, candidate.criteria!.category), compareLocation(source.criteria!.locations, candidate.criteria!.locations), compareDays(source.criteria!.availability, candidate.criteria!.availability), compareTime(source.criteria!.availability, candidate.criteria!.availability), compareDate(source.criteria!.dateWindow, candidate.criteria!.dateWindow), comparePrice(source.criteria!.priceRange, candidate.criteria!.priceRange), termsComparison(source, candidate)];
  if (comparisons.some((item) => item.outcome === "INCOMPATIBLE")) return null;
  const compatibleCount = comparisons.filter((item) => item.outcome === "COMPATIBLE").length;
  // V1: 15 points per structured compatibility plus up to 40 semantic points.
  // UNKNOWN is neutral and any hard incompatibility has already rejected the candidate.
  const internalScore = Math.round(compatibleCount * 15 + similarity * 40);
  const qualitativeBand = opportunityMatchBand(internalScore);
  return { targetGLinkId: candidate.id, internalScore, band: qualitativeBand, explanation: { engine: OPPORTUNITY_STRUCTURED_ENGINE_VERSION, band: qualitativeBand, comparisons, semanticSignals: similarity >= 0.45 ? [`Similarité subject/category/terms : ${similarity.toFixed(3)}`] : [] } };
}

export function rankStructuredOpportunityMatches(source: StructuredOpportunityMatchInput, candidates: StructuredOpportunityMatchInput[]) { return candidates.map((candidate) => matchStructuredOpportunity(source, candidate)).filter((value): value is StructuredOpportunityMatch => value !== null).sort((a, b) => b.internalScore - a.internalScore || a.targetGLinkId.localeCompare(b.targetGLinkId)); }
