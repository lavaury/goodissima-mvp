import {
  governedJourneyReadRepository,
  type GovernedJourneyReadRepository,
  type InternalGovernedJourneyLedgerRow,
} from "./repository";
import type {
  GovernedJourneyEvent,
  InternalGovernedJourneyLedgerView,
  InternalGovernedJourneyResolution,
} from "./types";

export type GovernedJourneyReadErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "LEGACY_EVENT_LOG_UNAVAILABLE"
  | "GOVERNED_JOURNEY_READ_FAILED";

export class GovernedJourneyReadError extends Error {
  constructor(public readonly code: GovernedJourneyReadErrorCode) {
    super(code);
    this.name = "GovernedJourneyReadError";
  }
}

function requiredId(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new GovernedJourneyReadError("INVALID_INPUT");
  return normalized;
}

function ledger(row: InternalGovernedJourneyLedgerRow): InternalGovernedJourneyLedgerView {
  return {
    id: row.id,
    relationTemplateId: row.relationTemplateId,
    relationCaseId: row.relationCaseId,
    ledgerStatus: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdFromTemplateVersionNumber: row.createdFromTemplateVersion?.version ?? null,
  };
}

async function stableRead<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof GovernedJourneyReadError) throw error;
    throw new GovernedJourneyReadError("GOVERNED_JOURNEY_READ_FAILED");
  }
}

export function createGovernedJourneyReadService(repository: GovernedJourneyReadRepository = governedJourneyReadRepository) {
  return {
    async findOptionalByRelationTemplateId(input: {
      relationTemplateId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<InternalGovernedJourneyLedgerView | null> {
      const scopedInput = {
        relationTemplateId: requiredId(input.relationTemplateId),
        workspaceId: requiredId(input.workspaceId),
        requesterUserId: requiredId(input.requesterUserId),
      };
      return stableRead(async () => {
        const result = await repository.findOptionalByRelationTemplateId(scopedInput);
        if (!result) throw new GovernedJourneyReadError("NOT_FOUND");
        return result.ledger ? ledger(result.ledger) : null;
      });
    },

    async findOptionalByFormTemplateId(input: {
      formTemplateId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<InternalGovernedJourneyResolution> {
      const scopedInput = {
        formTemplateId: requiredId(input.formTemplateId),
        workspaceId: requiredId(input.workspaceId),
        requesterUserId: requiredId(input.requesterUserId),
      };
      return stableRead(async () => {
        const result = await repository.findOptionalByFormTemplateId(scopedInput);
        if (!result) throw new GovernedJourneyReadError("NOT_FOUND");
        return { ...result, ledger: result.ledger ? ledger(result.ledger) : null };
      });
    },

    async listLegacyEvents(input: {
      governedJourneyId: string;
      relationCaseId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<GovernedJourneyEvent[]> {
      const scopedInput = {
        governedJourneyId: requiredId(input.governedJourneyId),
        relationCaseId: requiredId(input.relationCaseId),
        workspaceId: requiredId(input.workspaceId),
        requesterUserId: requiredId(input.requesterUserId),
      };
      return stableRead(async () => {
        const result = await repository.listLegacyEvents(scopedInput);
        if (result.kind !== "FOUND") throw new GovernedJourneyReadError(result.kind);
        return result.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() }));
      });
    },
  };
}

export const governedJourneyReadService = createGovernedJourneyReadService();
