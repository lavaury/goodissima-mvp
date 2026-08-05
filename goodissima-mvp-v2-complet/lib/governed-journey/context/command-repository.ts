import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AttachContextInput = {
  relationTemplateId: string;
  relationCaseId: string;
  workspaceId: string;
  requesterUserId: string;
};

type ContextRow = {
  governedJourneyId: string;
  relationTemplateId: string;
  relationCaseId: string;
  createdAt: Date;
};

export type AttachContextRepositoryResult =
  | { kind: "CREATED"; context: ContextRow }
  | { kind: "EXISTING"; context: ContextRow }
  | { kind: "NOT_FOUND" }
  | { kind: "GOVERNED_JOURNEY_EXTENSION_NOT_FOUND" }
  | { kind: "GOVERNED_JOURNEY_CONTEXT_CONFLICT" };

const contextSelect = {
  governedJourneyId: true,
  relationTemplateId: true,
  relationCaseId: true,
  createdAt: true,
} satisfies Prisma.GovernedJourneyRelationCaseSelect;

async function validateAndFindExisting(tx: Prisma.TransactionClient, input: AttachContextInput) {
  const relationTemplate = await tx.relationTemplate.findFirst({
    where: {
      id: input.relationTemplateId,
      workspaceId: input.workspaceId,
      workspace: { ownerId: input.requesterUserId, status: "ACTIVE" },
    },
    select: { governedJourney: { select: { id: true } } },
  });
  if (!relationTemplate) return { kind: "NOT_FOUND" as const };
  if (!relationTemplate.governedJourney) return { kind: "GOVERNED_JOURNEY_EXTENSION_NOT_FOUND" as const };

  const relationCase = await tx.relationCase.findFirst({
    where: {
      id: input.relationCaseId,
      templateId: input.relationTemplateId,
      workspaceId: input.workspaceId,
      ownerId: input.requesterUserId,
    },
    select: { id: true },
  });
  if (!relationCase) return { kind: "NOT_FOUND" as const };

  const exactContext = await tx.governedJourneyRelationCase.findUnique({
    where: {
      governedJourneyId_relationCaseId: {
        governedJourneyId: relationTemplate.governedJourney.id,
        relationCaseId: relationCase.id,
      },
    },
    select: contextSelect,
  });
  if (exactContext) return { kind: "EXISTING" as const, context: exactContext };

  const incompatibleContext = await tx.governedJourneyRelationCase.findFirst({
    where: { relationCaseId: relationCase.id },
    select: { governedJourneyId: true, relationTemplateId: true },
  });
  if (incompatibleContext) return { kind: "GOVERNED_JOURNEY_CONTEXT_CONFLICT" as const };

  return {
    kind: "READY" as const,
    governedJourneyId: relationTemplate.governedJourney.id,
    relationCaseId: relationCase.id,
  };
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function isStructuralConstraintConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2003");
}

export type GovernedJourneyRelationCaseContextCommandRepository = {
  attach(input: AttachContextInput): Promise<AttachContextRepositoryResult>;
};

export function createGovernedJourneyRelationCaseContextCommandRepository(
  database: PrismaClient = prisma,
): GovernedJourneyRelationCaseContextCommandRepository {
  return {
    async attach(input) {
      try {
        return await database.$transaction(async (tx) => {
          const validation = await validateAndFindExisting(tx, input);
          if (validation.kind !== "READY") return validation;
          const context = await tx.governedJourneyRelationCase.create({
            data: {
              governedJourneyId: validation.governedJourneyId,
              relationCaseId: validation.relationCaseId,
              relationTemplateId: input.relationTemplateId,
              createdByUserId: input.requesterUserId,
            },
            select: contextSelect,
          });
          return { kind: "CREATED", context };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isUniqueConflict(error)) {
          return database.$transaction(async (tx) => {
            const validation = await validateAndFindExisting(tx, input);
            if (validation.kind === "EXISTING") return validation;
            if (validation.kind === "READY") return { kind: "GOVERNED_JOURNEY_CONTEXT_CONFLICT" };
            return validation;
          }, { isolationLevel: "Serializable" });
        }
        if (isStructuralConstraintConflict(error)) return { kind: "GOVERNED_JOURNEY_CONTEXT_CONFLICT" };
        throw error;
      }
    },
  };
}

export const governedJourneyRelationCaseContextCommandRepository =
  createGovernedJourneyRelationCaseContextCommandRepository();
