import type { Prisma, PrismaClient } from "@prisma/client";

type CreationRequestDatabase = PrismaClient | Prisma.TransactionClient;

const completedCreationRequestSelect = {
  requesterUserId: true,
  requestKey: true,
  requestFingerprint: true,
  workspaceScopeKey: true,
  workspaceId: true,
  relationTemplateId: true,
  formTemplateId: true,
  governedJourneyId: true,
  completedAt: true,
  workspace: { select: { id: true, ownerId: true, status: true } },
  relationTemplate: { select: { id: true, workspaceId: true } },
  formTemplate: { select: { id: true, relationTemplateId: true } },
  governedJourney: { select: { id: true, relationTemplateId: true, formTemplateId: true } },
} satisfies Prisma.GovernedJourneyCreationRequestSelect;

export type CompletedCreationRequest = Prisma.GovernedJourneyCreationRequestGetPayload<{
  select: typeof completedCreationRequestSelect;
}>;

export function findCompletedCreationRequest(
  database: CreationRequestDatabase,
  input: { requesterUserId: string; requestKey: string },
) {
  return database.governedJourneyCreationRequest.findUnique({
    where: {
      requesterUserId_requestKey: {
        requesterUserId: input.requesterUserId,
        requestKey: input.requestKey,
      },
    },
    select: completedCreationRequestSelect,
  });
}

export function reserveCreationRequest(input: {
  tx: Prisma.TransactionClient;
  requesterUserId: string;
  requestKey: string;
  requestFingerprint: string;
  workspaceScopeKey: string;
}) {
  return input.tx.governedJourneyCreationRequest.create({
    data: {
      requesterUserId: input.requesterUserId,
      requestKey: input.requestKey,
      requestFingerprint: input.requestFingerprint,
      workspaceScopeKey: input.workspaceScopeKey,
      workspaceId: null,
      relationTemplateId: null,
      formTemplateId: null,
      governedJourneyId: null,
      completedAt: null,
    },
    select: { id: true },
  });
}

export function completeCreationRequest(input: {
  tx: Prisma.TransactionClient;
  requesterUserId: string;
  requestKey: string;
  workspaceId: string;
  relationTemplateId: string;
  formTemplateId: string;
  governedJourneyId: string;
  completedAt: Date;
}) {
  return input.tx.governedJourneyCreationRequest.updateMany({
    where: {
      requesterUserId: input.requesterUserId,
      requestKey: input.requestKey,
      workspaceId: null,
      relationTemplateId: null,
      formTemplateId: null,
      governedJourneyId: null,
      completedAt: null,
    },
    data: {
      workspaceId: input.workspaceId,
      relationTemplateId: input.relationTemplateId,
      formTemplateId: input.formTemplateId,
      governedJourneyId: input.governedJourneyId,
      completedAt: input.completedAt,
    },
  });
}

function prismaTarget(error: unknown) {
  if (!error || typeof error !== "object" || !("meta" in error)) return "";
  const meta = error.meta;
  if (!meta || typeof meta !== "object" || !("target" in meta)) return "";
  return Array.isArray(meta.target) ? meta.target.join(",") : String(meta.target ?? "");
}

export function isCreationRequestUniqueConflict(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false;
  const target = prismaTarget(error);
  return target.includes("GovernedJourneyCreationRequest_requesterUserId_requestKey_key")
    || (target.includes("requesterUserId") && target.includes("requestKey"));
}

export function isPrismaUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export function isPrismaSerializationConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034");
}
