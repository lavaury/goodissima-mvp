import { createHash, timingSafeEqual } from "node:crypto";
import type { WorkspaceCategory } from "@prisma/client";

const requestKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type GovernedJourneyCreationFingerprintInput = {
  requesterUserId: string;
  workspaceScopeKey: string;
  name: string;
  initialNeed: string;
  objective: string;
  workspaceCategory: WorkspaceCategory;
  participants: string[];
  documents: string[];
  confidentialityRules: string[];
  firstActions: string[];
  aiProvenance: {
    provider: string;
    model: string;
    promptVersion: string;
  } | null;
};

export function normalizeCreationRequestKey(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return requestKeyPattern.test(normalized) ? normalized : null;
}

export function buildWorkspaceScopeKey(input: { workspaceId: string; workspaceSlug: string }) {
  const key = input.workspaceId ? `id:${input.workspaceId}` : `slug:${input.workspaceSlug}`;
  if (key.length < 4 || key.length > 256) throw new Error("INVALID_WORKSPACE_SCOPE");
  return key;
}

export function buildGovernedJourneyCreationFingerprint(input: GovernedJourneyCreationFingerprintInput) {
  const canonical = {
    contractVersion: 1,
    requesterUserId: input.requesterUserId,
    workspaceScope: { key: input.workspaceScopeKey },
    name: input.name,
    initialNeed: input.initialNeed,
    objective: input.objective,
    workspaceCategory: input.workspaceCategory,
    participants: input.participants,
    documents: input.documents,
    confidentialityRules: input.confidentialityRules,
    firstActions: input.firstActions,
    aiProvenance: input.aiProvenance,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function fingerprintsEqual(left: string, right: string) {
  if (left.length !== 64 || right.length !== 64) return false;
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export type CompletedCreationRequestState = {
  requesterUserId: string;
  requestKey: string;
  requestFingerprint: string;
  workspaceScopeKey: string;
  workspaceId: string | null;
  relationTemplateId: string | null;
  formTemplateId: string | null;
  governedJourneyId: string | null;
  completedAt: Date | null;
  workspace: { id: string; ownerId: string; status: string } | null;
  relationTemplate: { id: string; workspaceId: string | null } | null;
  formTemplate: { id: string; relationTemplateId: string | null } | null;
  governedJourney: { id: string; relationTemplateId: string; formTemplateId: string | null } | null;
};

export function evaluateCompletedCreationRequest(
  request: CompletedCreationRequestState,
  expected: { requesterUserId: string; requestKey: string; requestFingerprint: string; workspaceScopeKey: string },
) {
  if (request.requesterUserId !== expected.requesterUserId || request.requestKey !== expected.requestKey) {
    return { kind: "NOT_FOUND" as const };
  }
  if (!fingerprintsEqual(request.requestFingerprint, expected.requestFingerprint)
    || request.workspaceScopeKey !== expected.workspaceScopeKey) {
    return { kind: "CONFLICT" as const };
  }
  if (!request.workspace || request.workspace.ownerId !== expected.requesterUserId || request.workspace.status !== "ACTIVE") {
    return { kind: "NOT_FOUND" as const };
  }
  if (!request.completedAt || !request.workspaceId || !request.relationTemplateId || !request.formTemplateId || !request.governedJourneyId
    || request.workspace.id !== request.workspaceId) {
    return { kind: "CORRUPT" as const };
  }
  if (!request.relationTemplate || request.relationTemplate.id !== request.relationTemplateId
    || request.relationTemplate.workspaceId !== request.workspaceId
    || !request.formTemplate || request.formTemplate.id !== request.formTemplateId
    || request.formTemplate.relationTemplateId !== request.relationTemplateId
    || !request.governedJourney || request.governedJourney.id !== request.governedJourneyId
    || request.governedJourney.relationTemplateId !== request.relationTemplateId
    || request.governedJourney.formTemplateId !== request.formTemplateId) {
    return { kind: "CORRUPT" as const };
  }
  return { kind: "SUCCESS" as const, formTemplateId: request.formTemplateId };
}
