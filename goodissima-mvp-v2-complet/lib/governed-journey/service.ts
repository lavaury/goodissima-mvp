import type { GovernedJourneyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateGovernedJourneyInput = {
  relationCaseId: string;
  formTemplateId?: string;
  relationTemplateId?: string;
  templateVersionId: string;
  title: string;
  authorityUserId: string;
};

export class GovernedJourneyInvariantError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "CASE_NOT_FOUND" | "INVALID_AUTHORITY" | "TEMPLATE_NOT_FOUND" | "TEMPLATE_VERSION_MISMATCH") {
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
            occurredAt: now,
          },
        },
      },
      include: { events: true },
    });
  }, { isolationLevel: "Serializable" });
}
