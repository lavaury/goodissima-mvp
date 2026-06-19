import type { ProjectedRoles, ValidatedCiroPath } from "./path-types.js";

export class RoleProjectorV0 {
  constructor(private readonly paths: readonly ValidatedCiroPath[]) {}

  project(intent: string, mode: string): ProjectedRoles | undefined {
    const path = this.paths.find((candidate) => candidate.intent === intent && candidate.mode === mode);
    if (!path) return undefined;
    return {
      intent,
      roles: [...path.roleProjection.roles],
      evidence: path.roleEvidence,
    };
  }
}
