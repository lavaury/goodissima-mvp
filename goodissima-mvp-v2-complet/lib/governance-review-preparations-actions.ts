"use server";

import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GovernanceReviewPreparationMetadata = {
  reviewPreparationId: string;
  status: "PREPARED_NOT_STARTED";
  reason: string;
  question: string;
  note: string | null;
  preparedAt: string;
  updatedAt: string;
  preparedById: string;
  meetingCreated: false;
  notificationSent: false;
  aiSummaryGenerated: false;
  automaticDecision: false;
  workflowStarted: false;
};

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function existingReviewPreparations(value: unknown): GovernanceReviewPreparationMetadata[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const reviewPreparationId =
        typeof row.reviewPreparationId === "string" && row.reviewPreparationId.trim()
          ? row.reviewPreparationId.trim()
          : "";
      const reason = typeof row.reason === "string" && row.reason.trim() ? row.reason.trim() : "";
      const question = typeof row.question === "string" && row.question.trim() ? row.question.trim() : "";
      const preparedAt = typeof row.preparedAt === "string" && row.preparedAt.trim() ? row.preparedAt.trim() : "";
      const preparedById = typeof row.preparedById === "string" && row.preparedById.trim() ? row.preparedById.trim() : "";
      if (!reviewPreparationId || !reason || !question || !preparedAt || !preparedById) return null;

      return {
        reviewPreparationId,
        status: "PREPARED_NOT_STARTED" as const,
        reason,
        question,
        note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
        preparedAt,
        updatedAt: typeof row.updatedAt === "string" && row.updatedAt.trim() ? row.updatedAt.trim() : preparedAt,
        preparedById,
        meetingCreated: false as const,
        notificationSent: false as const,
        aiSummaryGenerated: false as const,
        automaticDecision: false as const,
        workflowStarted: false as const,
      };
    })
    .filter((item): item is GovernanceReviewPreparationMetadata => item !== null);
}

export async function prepareGovernanceReviewAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const reviewReason = textFromForm(formData, "reviewReason");
  const reviewQuestion = textFromForm(formData, "reviewQuestion");
  const optionalNote = textFromForm(formData, "optionalNote");

  if (!formTemplateId || !reviewReason || !reviewQuestion) {
    throw new Error("Informations de revue incompletes.");
  }

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    include: {
      relationTemplate: {
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const latestVersion = formTemplate?.relationTemplate?.versions[0];
  if (!formTemplate || !latestVersion) {
    throw new Error("Parcours introuvable.");
  }

  const snapshot = asRecord(latestVersion.snapshot);
  const metadata = asRecord(snapshot.metadata);
  const currentReviewPreparations = existingReviewPreparations(metadata.governanceReviewPreparations);
  const now = new Date().toISOString();

  const preparedReview: GovernanceReviewPreparationMetadata = {
    reviewPreparationId: `review-prepared-${randomUUID()}`,
    status: "PREPARED_NOT_STARTED",
    reason: reviewReason,
    question: reviewQuestion,
    note: optionalNote || null,
    preparedAt: now,
    updatedAt: now,
    preparedById: owner.id,
    meetingCreated: false,
    notificationSent: false,
    aiSummaryGenerated: false,
    automaticDecision: false,
    workflowStarted: false,
  };

  await prisma.templateVersion.update({
    where: { id: latestVersion.id },
    data: {
      snapshot: {
        ...snapshot,
        metadata: {
          ...metadata,
          governanceReviewPreparations: [...currentReviewPreparations, preparedReview],
        },
      } as Prisma.InputJsonObject,
    },
  });

  const path = `/gouvernance/parcours/${formTemplate.id}/pilotage`;
  revalidatePath(path);
  redirect(path);
}
