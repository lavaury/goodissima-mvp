import type { DeterministicIntentDetectorV0 } from "../detector/detector.js";
import type { IntentDetectionResult } from "../detector/types.js";
import { CIRO_SCHEMA_VERSION, type CiroRecord } from "./model.js";
import type { ValidatedCiroPath } from "./path-types.js";
import { RelationshipResolverV0 } from "./relationship-resolver.js";
import { RoleProjectorV0 } from "./role-projector.js";
import { validateCiro } from "./validator.js";

export class CiroBuilderV0 {
  private readonly roles: RoleProjectorV0;
  private readonly relationships: RelationshipResolverV0;

  constructor(
    private readonly detector: DeterministicIntentDetectorV0,
    private readonly paths: readonly ValidatedCiroPath[],
  ) {
    this.roles = new RoleProjectorV0(paths);
    this.relationships = new RelationshipResolverV0(paths);
  }

  detect(input: string): IntentDetectionResult {
    return this.detector.detect(input);
  }

  hasPath(intent: string, mode: string): boolean {
    return this.paths.some((path) => path.intent === intent && path.mode === mode);
  }

  governedPathCount(): number {
    return this.paths.length;
  }

  build(input: string): CiroRecord | undefined {
    const detection = this.detector.detect(input);
    const intents = detection.candidates.filter((candidate) => candidate.kind === "intent");
    const modes = detection.candidates.filter((candidate) => candidate.kind === "mode");
    if (intents.length !== 1 || modes.length !== 1) return undefined;

    const intent = intents[0].label;
    const mode = modes[0].label;
    const path = this.paths.find((candidate) => candidate.intent === intent && candidate.mode === mode);
    if (!path) return undefined;
    const roles = this.roles.project(intent, mode);
    const relationship = this.relationships.resolve(intent, mode);
    if (!roles || !relationship) return undefined;

    const template = path.ciroProjection;
    const c = template.c as { intent?: unknown; mode?: unknown };
    const r = template.r as { roles?: unknown };
    const o = template.o as { relationship?: unknown };
    if (c.intent !== intent || c.mode !== mode) throw new Error("CIRO projection does not match the detected path.");
    if (JSON.stringify(r.roles) !== JSON.stringify(roles.roles)) throw new Error("CIRO projection does not match projected roles.");
    if (o.relationship !== relationship.relationship) throw new Error("CIRO projection does not match the resolved relationship.");

    const sources = [
      ...intents.flatMap((candidate) => candidate.evidence),
      ...modes.flatMap((candidate) => candidate.evidence),
      roles.evidence,
      relationship.evidence,
    ].map((evidence) => ({
      knowledgeId: evidence.knowledgeId,
      locator: `line:${evidence.locator.startLine}-${evidence.locator.endLine}`,
    }));
    const uniqueSources = [...new Map(
      sources.map((source) => [`${source.knowledgeId}\u0000${source.locator}`, source]),
    ).values()];

    const record: CiroRecord = {
      schemaVersion: CIRO_SCHEMA_VERSION,
      c: template.c,
      i: template.i,
      r: template.r,
      o: template.o,
      sources: uniqueSources,
    };
    const validation = validateCiro(record);
    if (!validation.valid) throw new Error(`Built CIRO is invalid: ${validation.issues[0].message}`);
    return record;
  }
}
