import {
  governedJourneyRelationCaseContextCommandRepository,
  type GovernedJourneyRelationCaseContextCommandRepository,
} from "./command-repository";
import type { AttachGovernedJourneyRelationCaseContextResult } from "./types";

export type GovernedJourneyRelationCaseContextCommandErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "GOVERNED_JOURNEY_EXTENSION_NOT_FOUND"
  | "GOVERNED_JOURNEY_CONTEXT_CONFLICT"
  | "GOVERNED_JOURNEY_CONTEXT_ATTACH_FAILED";

export class GovernedJourneyRelationCaseContextCommandError extends Error {
  constructor(public readonly code: GovernedJourneyRelationCaseContextCommandErrorCode) {
    super(code);
    this.name = "GovernedJourneyRelationCaseContextCommandError";
  }
}

function requiredId(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new GovernedJourneyRelationCaseContextCommandError("INVALID_INPUT");
  return normalized;
}

export function createGovernedJourneyRelationCaseContextCommandService(
  repository: GovernedJourneyRelationCaseContextCommandRepository = governedJourneyRelationCaseContextCommandRepository,
) {
  return {
    async attachRelationCaseContext(input: {
      relationTemplateId: string;
      relationCaseId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<AttachGovernedJourneyRelationCaseContextResult> {
      const scopedInput = {
        relationTemplateId: requiredId(input.relationTemplateId),
        relationCaseId: requiredId(input.relationCaseId),
        workspaceId: requiredId(input.workspaceId),
        requesterUserId: requiredId(input.requesterUserId),
      };
      try {
        const result = await repository.attach(scopedInput);
        if (result.kind !== "CREATED" && result.kind !== "EXISTING") {
          throw new GovernedJourneyRelationCaseContextCommandError(result.kind);
        }
        return {
          ...result.context,
          createdAt: result.context.createdAt.toISOString(),
          created: result.kind === "CREATED",
        };
      } catch (error) {
        if (error instanceof GovernedJourneyRelationCaseContextCommandError) throw error;
        throw new GovernedJourneyRelationCaseContextCommandError("GOVERNED_JOURNEY_CONTEXT_ATTACH_FAILED");
      }
    },
  };
}

export const governedJourneyRelationCaseContextCommandService =
  createGovernedJourneyRelationCaseContextCommandService();
