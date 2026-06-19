import type { ResolvedRelationship, ValidatedCiroPath } from "./path-types.js";

export class RelationshipResolverV0 {
  constructor(private readonly paths: readonly ValidatedCiroPath[]) {}

  resolve(intent: string, mode: string): ResolvedRelationship | undefined {
    const path = this.paths.find((candidate) => candidate.intent === intent && candidate.mode === mode);
    if (!path) return undefined;
    return {
      intent,
      relationship: path.relationshipResolution.relationship,
      evidence: path.relationshipEvidence,
    };
  }
}
