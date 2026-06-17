import { normalizeDetectorText } from "./normalization.js";
import type {
  DetectorCandidate,
  DetectorMatchType,
  IntentDetectionResult,
  ValidatedDetectorExpression,
} from "./types.js";

interface Match {
  type: DetectorMatchType;
  confidence: number;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsWholeExpression(input: string, expression: string): boolean {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegularExpression(expression)}(?![\\p{L}\\p{N}])`,
    "u",
  );
  return pattern.test(input);
}

function matchExpression(input: string, expression: string): Match | undefined {
  if (input === expression) return { type: "exact", confidence: 1 };
  if (containsWholeExpression(input, expression)) {
    return { type: "exact_substring", confidence: 0.95 };
  }

  const normalizedInput = normalizeDetectorText(input);
  const normalizedExpression = normalizeDetectorText(expression);
  if (!normalizedInput || !normalizedExpression) return undefined;
  if (normalizedInput === normalizedExpression) return { type: "normalized", confidence: 0.9 };
  if (` ${normalizedInput} `.includes(` ${normalizedExpression} `)) {
    return { type: "normalized_substring", confidence: 0.8 };
  }
  return undefined;
}

export class DeterministicIntentDetectorV0 {
  constructor(private readonly expressions: readonly ValidatedDetectorExpression[]) {}

  detect(input: string): IntentDetectionResult {
    const matches = this.expressions.flatMap((entry) => {
      const match = matchExpression(input, entry.expression);
      if (!match) return [];
      return [{
        kind: entry.kind,
        label: entry.label,
        confidence: match.confidence,
        evidence: [{
          knowledgeId: entry.knowledgeId,
          unitId: entry.unitId,
          locator: entry.locator,
          expression: entry.expression,
          matchType: match.type,
        }],
      }];
    });

    const grouped = new Map<string, DetectorCandidate>();
    for (const candidate of matches) {
      const key = `${candidate.kind}\u0000${candidate.label}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, candidate);
        continue;
      }
      existing.confidence = Math.max(existing.confidence, candidate.confidence);
      existing.evidence.push(...candidate.evidence);
    }
    const candidates = [...grouped.values()];

    candidates.sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.label.localeCompare(right.label, "fr") ||
        left.kind.localeCompare(right.kind),
    );
    const topConfidence = candidates[0]?.confidence;
    return {
      version: "0",
      candidates,
      ambiguous:
        topConfidence !== undefined &&
        candidates.filter((candidate) => candidate.confidence === topConfidence).length > 1,
    };
  }
}
