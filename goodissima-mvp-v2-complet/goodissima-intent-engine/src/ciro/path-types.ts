import type { JsonValue } from "./model.js";
import type { CorpusLocator } from "../corpus/types.js";

export interface SourceMapping {
  knowledgeId: string;
  expression: string;
}

export interface RoleProjectionMapping extends SourceMapping {
  roles: string[];
}

export interface RelationshipResolutionMapping extends SourceMapping {
  relationship: string;
}

export interface CiroProjectionTemplate {
  c: JsonValue;
  i: JsonValue;
  r: JsonValue;
  o: JsonValue;
}

export interface CiroPathMapping {
  intent: string;
  mode: string;
  roleProjection: RoleProjectionMapping;
  relationshipResolution: RelationshipResolutionMapping;
  ciroProjection: CiroProjectionTemplate;
}

export interface CiroPathManifest {
  version: "1.0";
  paths: CiroPathMapping[];
}

export interface MappingEvidence extends SourceMapping {
  unitId: string;
  locator: CorpusLocator;
}

export interface ProjectedRoles {
  intent: string;
  roles: string[];
  evidence: MappingEvidence;
}

export interface ResolvedRelationship {
  intent: string;
  relationship: string;
  evidence: MappingEvidence;
}

export interface ValidatedCiroPath extends CiroPathMapping {
  roleEvidence: MappingEvidence;
  relationshipEvidence: MappingEvidence;
}
