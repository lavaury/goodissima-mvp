import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CiroRecord, JsonValue } from "../ciro/model.js";
import type { CompatibilityMatrix, MergeScoreResult, ScoringRules } from "./types.js";

function knowledgeFile(name: string): string {
  const candidates = [
    path.join(process.cwd(), "knowledge/merge", name),
    path.join(process.cwd(), "goodissima-intent-engine/knowledge/merge", name),
  ];
  const resolved = candidates.find(existsSync);
  if (!resolved) throw new Error(`Merge knowledge file not found: ${name}.`);
  return resolved;
}

const defaultMatrix = JSON.parse(readFileSync(knowledgeFile("compatibility-matrix.v0.json"), "utf8")) as CompatibilityMatrix;
const defaultRules = JSON.parse(readFileSync(knowledgeFile("scoring-rules.v1.json"), "utf8")) as ScoringRules;

function field(record: CiroRecord, path: string): JsonValue | undefined {
  return path.split(".").reduce<JsonValue | undefined>((value, key) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    return value[key];
  }, record as unknown as JsonValue);
}

function sameExplicitValue(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return left !== undefined && right !== undefined && JSON.stringify(left) === JSON.stringify(right);
}

export function scoreMergeWithRules(ciroA: CiroRecord, ciroB: CiroRecord, matrix: CompatibilityMatrix, rules: ScoringRules): MergeScoreResult {
  const leftRelationship = field(ciroA, rules.dimensions.relationship.path);
  const rightRelationship = field(ciroB, rules.dimensions.relationship.path);
  const entry = matrix.entries.find((candidate) => candidate.compatible && candidate.leftRelationship === leftRelationship && candidate.rightRelationship === rightRelationship);
  if (!entry) {
    return { relationshipScore: 0, roleScore: 0, trustScore: 0, familyScore: 0, totalScore: 0, status: "NO_MATCH", explanation: ["No explicit compatibility matrix entry exists for the CIRO relationship pair."] };
  }
  const explanation = [`Relationship pair is explicitly compatible through matrix entry ${entry.id}.`];
  const compare = (name: "role" | "trust" | "family"): number => {
    const rule = rules.dimensions[name];
    const matched = sameExplicitValue(field(ciroA, rule.path), field(ciroB, rule.path));
    explanation.push(`${name} ${matched ? "matches exactly" : "does not match exactly"} at ${rule.path}.`);
    return matched ? rule.score : 0;
  };
  const relationshipScore = rules.dimensions.relationship.score;
  const roleScore = compare("role");
  const trustScore = compare("trust");
  const familyScore = compare("family");
  const totalScore = relationshipScore + roleScore + trustScore + familyScore;
  const status = rules.statuses.find((candidate) => totalScore >= candidate.minimumScore)?.status ?? "NO_MATCH";
  return { relationshipScore, roleScore, trustScore, familyScore, totalScore, status, explanation };
}

export function scoreMerge(ciroA: CiroRecord, ciroB: CiroRecord): MergeScoreResult {
  return scoreMergeWithRules(ciroA, ciroB, defaultMatrix, defaultRules);
}
