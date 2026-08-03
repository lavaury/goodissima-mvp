import type { GovernedJourneyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  findGovernedJourneyTransition,
  governedJourneyCommandTargets,
  governedJourneyLifecycleDates,
  isGovernedJourneyCommandIdempotent,
  normalizeGovernedJourneyReason,
  type GovernedJourneyCommand,
} from "@/lib/governed-journey/lifecycle";

export type CreateGovernedJourneyInput = {
  relationCaseId: string;
  formTemplateId?: string;
  relationTemplateId?: string;
  templateVersionId: string;
  title: string;
  authorityUserId: string;
};

export class GovernedJourneyInvariantError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "CASE_NOT_FOUND" | "INVALID_AUTHORITY" | "TEMPLATE_NOT_FOUND" | "TEMPLATE_VERSION_MISMATCH" | "NOT_FOUND" | "INVALID_TRANSITION" | "REASON_REQUIRED" | "VERSION_CONFLICT") {
    super(code);
    this.name = "GovernedJourneyInvariantError";
  }
}

function required(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function createGovernedJourney(input: CreateGovernedJourneyInput) {
  const title = input.title.trim();
  if (!required(input.relationCaseId) || !required(input.templateVersionId) || !required(input.authorityUserId) || !title) {
    throw new GovernedJourneyInvariantError("INVALID_INPUT");
  }
  if (!required(input.formTemplateId) && !required(input.relationTemplateId)) {
    throw new GovernedJourneyInvariantError("INVALID_INPUT");
  }

  return prisma.$transaction(async (tx) => {
    const relationCase = await tx.relationCase.findUnique({
      where: { id: input.relationCaseId },
      select: { id: true, ownerId: true },
    });
    if (!relationCase) throw new GovernedJourneyInvariantError("CASE_NOT_FOUND");
    if (relationCase.ownerId !== input.authorityUserId) throw new GovernedJourneyInvariantError("INVALID_AUTHORITY");

    const formTemplate = input.formTemplateId
      ? await tx.formTemplate.findUnique({
          where: { id: input.formTemplateId },
          select: { id: true, relationTemplateId: true },
        })
      : null;
    if (input.formTemplateId && !formTemplate) throw new GovernedJourneyInvariantError("TEMPLATE_NOT_FOUND");

    const relationTemplateId = input.relationTemplateId ?? formTemplate?.relationTemplateId;
    if (!relationTemplateId || (formTemplate && formTemplate.relationTemplateId !== relationTemplateId)) {
      throw new GovernedJourneyInvariantError("TEMPLATE_NOT_FOUND");
    }

    const [relationTemplate, templateVersion] = await Promise.all([
      tx.relationTemplate.findUnique({ where: { id: relationTemplateId }, select: { id: true } }),
      tx.templateVersion.findUnique({ where: { id: input.templateVersionId }, select: { id: true, templateId: true } }),
    ]);
    if (!relationTemplate) throw new GovernedJourneyInvariantError("TEMPLATE_NOT_FOUND");
    if (!templateVersion || templateVersion.templateId !== relationTemplateId) {
      throw new GovernedJourneyInvariantError("TEMPLATE_VERSION_MISMATCH");
    }

    const now = new Date();
    return tx.governedJourney.create({
      data: {
        relationCaseId: relationCase.id,
        formTemplateId: formTemplate?.id,
        relationTemplateId,
        createdFromTemplateVersionId: templateVersion.id,
        title,
        status: "DRAFT" satisfies GovernedJourneyStatus,
        authorityUserId: input.authorityUserId,
        events: {
          create: {
            type: "CREATED",
            actorUserId: input.authorityUserId,
            fromStatus: null,
            toStatus: "DRAFT",
            reason: null,
            sequence: 1,
            occurredAt: now,
          },
        },
      },
      include: { events: true },
    });
  }, { isolationLevel: "Serializable" });
}

export type TransitionGovernedJourneyInput = {
  governedJourneyId: string;
  relationCaseId: string;
  actorUserId: string;
  expectedVersion: number;
  occurredAt?: Date;
  reason?: string;
};

function isRetryablePrismaConflict(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "P2002" || error.code === "P2034";
}

async function transitionGovernedJourney(command: GovernedJourneyCommand, input: TransitionGovernedJourneyInput) {
  if (!required(input.governedJourneyId) || !required(input.relationCaseId) || !required(input.actorUserId)
    || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new GovernedJourneyInvariantError("INVALID_INPUT");
  }
  const occurredAt = input.occurredAt ?? new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new GovernedJourneyInvariantError("INVALID_INPUT");
  const normalizedReason = normalizeGovernedJourneyReason(input.reason, command === "SUSPEND" || command === "CANCEL");
  if (!normalizedReason.ok) throw new GovernedJourneyInvariantError(normalizedReason.code);

  try {
    return await prisma.$transaction(async (tx) => {
      const journey = await tx.governedJourney.findFirst({
        where: {
          id: input.governedJourneyId,
          relationCaseId: input.relationCaseId,
          relationCase: { ownerId: input.actorUserId },
        },
      });
      if (!journey) throw new GovernedJourneyInvariantError("NOT_FOUND");
      if (journey.authorityUserId !== input.actorUserId) throw new GovernedJourneyInvariantError("INVALID_AUTHORITY");

      if (isGovernedJourneyCommandIdempotent(journey.status, command)) {
        return { journey, event: undefined, changed: false as const };
      }
      const transition = findGovernedJourneyTransition(journey.status, command);
      if (!transition) throw new GovernedJourneyInvariantError("INVALID_TRANSITION");
      if (journey.version !== input.expectedVersion) throw new GovernedJourneyInvariantError("VERSION_CONFLICT");

      const nextVersion = journey.version + 1;
      const updated = await tx.governedJourney.updateMany({
        where: {
          id: journey.id,
          relationCaseId: journey.relationCaseId,
          authorityUserId: journey.authorityUserId,
          status: transition.from,
          version: input.expectedVersion,
        },
        data: {
          status: transition.to,
          version: { increment: 1 },
          ...governedJourneyLifecycleDates(command, journey, occurredAt),
        },
      });
      if (updated.count !== 1) throw new GovernedJourneyInvariantError("VERSION_CONFLICT");

      const event = await tx.governedJourneyEvent.create({
        data: {
          governedJourneyId: journey.id,
          relationCaseId: journey.relationCaseId,
          type: transition.eventType,
          actorUserId: input.actorUserId,
          authorityUserId: journey.authorityUserId,
          fromStatus: transition.from,
          toStatus: transition.to,
          reason: normalizedReason.value,
          sequence: nextVersion,
          occurredAt,
        },
      });
      const transitionedJourney = await tx.governedJourney.findUniqueOrThrow({ where: { id: journey.id } });
      return { journey: transitionedJourney, event, changed: true as const };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof GovernedJourneyInvariantError) throw error;
    if (isRetryablePrismaConflict(error)) throw new GovernedJourneyInvariantError("VERSION_CONFLICT");
    throw new Error("GOVERNED_JOURNEY_TRANSITION_FAILED");
  }
}

export const activateGovernedJourney = (input: TransitionGovernedJourneyInput) => transitionGovernedJourney("ACTIVATE", input);
export const suspendGovernedJourney = (input: TransitionGovernedJourneyInput) => transitionGovernedJourney("SUSPEND", input);
export const resumeGovernedJourney = (input: TransitionGovernedJourneyInput) => transitionGovernedJourney("RESUME", input);
export const closeGovernedJourney = (input: TransitionGovernedJourneyInput) => transitionGovernedJourney("CLOSE", input);
export const cancelGovernedJourney = (input: TransitionGovernedJourneyInput) => transitionGovernedJourney("CANCEL", input);

export { governedJourneyCommandTargets };
