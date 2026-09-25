import type { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createJourneyRootAndCreated, createdJourneyReadbackMatches, type CreatedJourneyIdentity } from "./governed-journey-root-creation.ts";

type Client = PrismaClient | Prisma.TransactionClient;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const value = (input: unknown): string | null => typeof input === "string" && input.trim() ? input : null;

export const R2_REASON = "Lifecycle/root reconciliation for historical Journey created by governance-v1-minimal-create before governed root creation.";

function existingRootLifecycleMatches(root: NonNullable<Parameters<typeof createdJourneyReadbackMatches>[0]>, expected: CreatedJourneyIdentity): boolean {
  if (root.id !== expected.id || root.relationTemplateId !== expected.relationTemplateId
    || root.formTemplateId !== expected.formTemplateId || root.authorityUserId !== expected.authorityUserId
    || root.relationCaseId !== expected.relationCaseId) return false;
  const created = root.events.filter((event) => event.type === "CREATED");
  return created.length === 1 && created[0].sequence === 1 && created[0].fromStatus === null
    && created[0].toStatus === "DRAFT" && created[0].actorUserId === expected.authorityUserId
    && created[0].authorityUserId === expected.authorityUserId
    && created[0].relationCaseId === expected.relationCaseId;
}

async function loadCandidate(client: Client, relationTemplateId: string) {
  return client.relationTemplate.findUnique({
    where: { id: relationTemplateId },
    select: {
      id: true, key: true, name: true, description: true, workspaceId: true,
      workspace: { select: { ownerId: true } },
      versions: { where: { version: 1 }, take: 1, select: { id: true, templateId: true, snapshot: true, name: true, description: true } },
      formTemplates: { select: { id: true, key: true, name: true, description: true, relationTemplateId: true } },
      governedJourney: { select: { id: true, relationTemplateId: true, formTemplateId: true, createdFromTemplateVersionId: true, relationCaseId: true, authorityUserId: true, status: true,
        events: { orderBy: { sequence: "asc" }, select: { type: true, sequence: true, fromStatus: true, toStatus: true, actorUserId: true, authorityUserId: true, relationCaseId: true } } } },
      generations: { select: { createdById: true } },
      relationCases: { select: { id: true, ownerId: true } },
      links: { select: { ownerId: true } },
      governedJourneyCreationRequest: { select: { requesterUserId: true, formTemplateId: true } },
    },
  });
}

export type R2Assessment =
  | { status: "NOT_CANDIDATE" | "AUTHORITY_AMBIGUOUS" | "ROOT_INCOMPLETE"; reason: string }
  | { status: "AUTHORITY_PROVEN" | "ALREADY_RECONCILED"; authorityUserId: string; formTemplateId: string; relationTemplateId: string; templateVersionId: string; relationCaseId: string | null; proof: string[]; journeyId?: string };

function assessLoaded(candidate: NonNullable<Awaited<ReturnType<typeof loadCandidate>>>): R2Assessment {
  const version = candidate.versions[0];
  const snapshot = record(version?.snapshot);
  const metadata = record(snapshot.metadata);
  const plan = record(metadata.creationPlan);
  const snapshotTemplate = record(snapshot.relationTemplate);
  const snapshotForm = record(snapshot.formTemplate);
  const creator = value(metadata.createdById);
  const form = candidate.formTemplates.find((item) => item.id === snapshotForm.id);
  if (!version || metadata.source !== "governance-v1-minimal-create" || metadata.snapshotVersion !== 2 || !creator || !Object.keys(plan).length
    || snapshotTemplate.id !== candidate.id || snapshotTemplate.key !== candidate.key || snapshotTemplate.name !== candidate.name
    || !form || snapshotForm.key !== form.key || snapshotForm.name !== form.name || form.relationTemplateId !== candidate.id
    || version.templateId !== candidate.id || version.name !== candidate.name
    || (value(plan.createdBy) && plan.createdBy !== creator)
    || (metadata.workspaceId ?? null) !== candidate.workspaceId) {
    return { status: "NOT_CANDIDATE", reason: "Historical minimal-flow markers or snapshot/form/template coherence failed." };
  }
  const proof = [
    candidate.workspace?.ownerId === creator ? "WORKSPACE_OWNER" : null,
    candidate.generations.some((item) => item.createdById === creator) ? "TEMPLATE_GENERATION" : null,
    candidate.relationCases.some((item) => item.ownerId === creator) ? "RELATION_CASE_OWNER" : null,
    candidate.links.some((item) => item.ownerId === creator) ? "LINK_OWNER" : null,
    candidate.governedJourneyCreationRequest?.requesterUserId === creator
      && candidate.governedJourneyCreationRequest.formTemplateId === form.id ? "CREATION_REQUEST" : null,
  ].filter((item): item is string => Boolean(item));
  const independentOwners = [candidate.workspace?.ownerId, ...candidate.generations.map((item) => item.createdById),
    ...candidate.relationCases.map((item) => item.ownerId), ...candidate.links.map((item) => item.ownerId),
    candidate.governedJourneyCreationRequest?.requesterUserId].filter((item): item is string => Boolean(item));
  if (!proof.length || independentOwners.some((id) => id !== creator) || (candidate.workspaceId !== null && !candidate.workspace)
    || candidate.relationCases.length > 1) {
    return { status: "AUTHORITY_AMBIGUOUS", reason: "No independent matching owner proof, conflicting owner evidence, or ambiguous Case/Workspace." };
  }
  const caseId = value(plan.relationCaseId) ?? value(metadata.relationCaseId);
  if (caseId && !candidate.relationCases.some((item) => item.id === caseId)) {
    return { status: "AUTHORITY_AMBIGUOUS", reason: "The historical snapshot references a Case that is not attached to this template." };
  }
  if (candidate.relationCases.length && (!caseId || !candidate.relationCases.some((item) => item.id === caseId))) {
    return { status: "AUTHORITY_AMBIGUOUS", reason: "Existing Case is not explicitly identified by the historical snapshot." };
  }
  const identity = { authorityUserId: creator, formTemplateId: form.id, relationTemplateId: candidate.id,
    templateVersionId: version.id, relationCaseId: caseId ?? null, proof };
  if (candidate.governedJourney.length) {
    const root = candidate.governedJourney[0];
    if (candidate.governedJourney.length !== 1 || root.createdFromTemplateVersionId !== version.id
      || !existingRootLifecycleMatches(root, { id: root.id, relationTemplateId: candidate.id, formTemplateId: form.id,
        authorityUserId: creator, relationCaseId: identity.relationCaseId })) {
      return { status: "ROOT_INCOMPLETE", reason: "A root exists but its lifecycle or scope is incomplete; R2 must not act as R1." };
    }
    return { status: "ALREADY_RECONCILED", ...identity, journeyId: root.id };
  }
  return { status: "AUTHORITY_PROVEN", ...identity };
}

export async function assessMissingGovernedJourneyRoot(client: Client, relationTemplateId: string): Promise<R2Assessment> {
  if (!relationTemplateId) return { status: "NOT_CANDIDATE", reason: "Missing RelationTemplate ID." };
  const candidate = await loadCandidate(client, relationTemplateId);
  return candidate ? assessLoaded(candidate) : { status: "NOT_CANDIDATE", reason: "RelationTemplate not found." };
}

export async function reconcileMissingGovernedJourneyRoot(client: PrismaClient, relationTemplateId: string) {
  const result = await client.$transaction(async (tx) => {
    const assessment = await assessMissingGovernedJourneyRoot(tx, relationTemplateId);
    if (assessment.status === "ALREADY_RECONCILED") return assessment;
    if (assessment.status === "AUTHORITY_AMBIGUOUS") return { status: "SKIPPED_AUTHORITY_AMBIGUOUS" as const, reason: assessment.reason };
    if (assessment.status === "ROOT_INCOMPLETE") throw new Error(`R2 stopped: ${assessment.reason}`);
    if (assessment.status !== "AUTHORITY_PROVEN") throw new Error("R2 stopped: RelationTemplate is not an eligible historical Journey.");
    const journey = await createJourneyRootAndCreated(tx, {
      id: randomUUID(), relationTemplateId: assessment.relationTemplateId, formTemplateId: assessment.formTemplateId,
      createdFromTemplateVersionId: assessment.templateVersionId, authorityUserId: assessment.authorityUserId,
      relationCaseId: assessment.relationCaseId, title: (await tx.relationTemplate.findUniqueOrThrow({ where: { id: relationTemplateId }, select: { name: true } })).name,
      reason: R2_REASON,
    });
    // createJourneyRootAndCreated ends with SET CONSTRAINTS IMMEDIATE; no DB work follows it here.
    return { ...assessment, status: "RECONCILED" as const, journeyId: journey.id };
  }, { isolationLevel: "Serializable" });
  if (result.status === "SKIPPED_AUTHORITY_AMBIGUOUS") return result;
  const root = await client.governedJourney.findUnique({ where: { id: result.journeyId }, select: {
    id: true, relationTemplateId: true, formTemplateId: true, createdFromTemplateVersionId: true, authorityUserId: true,
    relationCaseId: true, status: true, events: { select: { type: true, sequence: true, fromStatus: true, toStatus: true,
      actorUserId: true, authorityUserId: true, relationCaseId: true, reason: true } },
  } });
  if (!root || root.createdFromTemplateVersionId !== result.templateVersionId
    || !(result.status === "RECONCILED" ? createdJourneyReadbackMatches : existingRootLifecycleMatches)(root, { id: result.journeyId!, relationTemplateId: result.relationTemplateId,
      formTemplateId: result.formTemplateId, authorityUserId: result.authorityUserId, relationCaseId: result.relationCaseId })
    || (result.status === "RECONCILED" && root.events[0].reason !== R2_REASON)) {
    throw new Error("R2 infrastructure error: GovernedJourney/CREATED read-back failed.");
  }
  return result;
}
