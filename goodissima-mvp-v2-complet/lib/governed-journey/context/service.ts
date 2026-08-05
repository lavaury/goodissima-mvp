import {
  governedJourneyRelationCaseContextRepository,
  type GovernedJourneyRelationCaseContextRepository,
  type GovernedJourneyRelationCaseContextRow,
} from "./repository";
import type {
  GovernedJourneyRelationCaseContextFormResolution,
  GovernedJourneyRelationCaseContextResolution,
  GovernedJourneyRelationCaseContextView,
} from "./types";

export type GovernedJourneyRelationCaseContextReadErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "GOVERNED_JOURNEY_CONTEXT_READ_FAILED";

export class GovernedJourneyRelationCaseContextReadError extends Error {
  constructor(public readonly code: GovernedJourneyRelationCaseContextReadErrorCode) {
    super(code);
    this.name = "GovernedJourneyRelationCaseContextReadError";
  }
}

function requiredId(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new GovernedJourneyRelationCaseContextReadError("INVALID_INPUT");
  return normalized;
}

function context(row: GovernedJourneyRelationCaseContextRow): GovernedJourneyRelationCaseContextView {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

async function stableRead<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof GovernedJourneyRelationCaseContextReadError) throw error;
    throw new GovernedJourneyRelationCaseContextReadError("GOVERNED_JOURNEY_CONTEXT_READ_FAILED");
  }
}

export function createGovernedJourneyRelationCaseContextService(
  repository: GovernedJourneyRelationCaseContextRepository = governedJourneyRelationCaseContextRepository,
) {
  return {
    async listByRelationTemplateId(input: {
      relationTemplateId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<GovernedJourneyRelationCaseContextResolution> {
      const scopedInput = {
        relationTemplateId: requiredId(input.relationTemplateId),
        workspaceId: requiredId(input.workspaceId),
        requesterUserId: requiredId(input.requesterUserId),
      };
      return stableRead(async () => {
        const result = await repository.listByRelationTemplateId(scopedInput);
        if (!result) throw new GovernedJourneyRelationCaseContextReadError("NOT_FOUND");
        return { ...result, contexts: result.contexts.map(context) };
      });
    },

    async listByFormTemplateId(input: {
      formTemplateId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<GovernedJourneyRelationCaseContextFormResolution> {
      const scopedInput = {
        formTemplateId: requiredId(input.formTemplateId),
        workspaceId: requiredId(input.workspaceId),
        requesterUserId: requiredId(input.requesterUserId),
      };
      return stableRead(async () => {
        const result = await repository.listByFormTemplateId(scopedInput);
        if (!result) throw new GovernedJourneyRelationCaseContextReadError("NOT_FOUND");
        return { ...result, contexts: result.contexts.map(context) };
      });
    },
  };
}

export const governedJourneyRelationCaseContextService = createGovernedJourneyRelationCaseContextService();
