"use server";

import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GovernanceReviewStatus = "PREPARED_NOT_STARTED" | "IN_HUMAN_REVIEW" | "COMPLETED";

type GovernanceReviewPreparationMetadata = {
  reviewPreparationId: string;
  status: GovernanceReviewStatus;
  reason: string;
  question: string;
  note: string | null;
  preparedAt: string;
  startedAt: string | null;
  completedAt: string | null;
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

function reviewStatus(value: unknown): GovernanceReviewStatus {
  return value === "IN_HUMAN_REVIEW" || value === "COMPLETED" ? value : "PREPARED_NOT_STARTED";
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function existingReviewPreparations(value: unknown): GovernanceReviewPreparationMetadata[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value.map((item) => {
    const row = asRecord(item);
    const reviewPreparationId = optionalText(row.reviewPreparationId);
    const reason = optionalText(row.reason);
    const question = optionalText(row.question);
    const preparedAt = optionalText(row.preparedAt);
    const preparedById = optionalText(row.preparedById);
    if (!reviewPreparationId || !reason || !question || !preparedAt || !preparedById) return null;

    return {
      reviewPreparationId,
      status: reviewStatus(row.status),
      reason,
      question,
      note: optionalText(row.note),
      preparedAt,
      startedAt: optionalText(row.startedAt),
      completedAt: optionalText(row.completedAt),
      updatedAt: optionalText(row.updatedAt) ?? preparedAt,
      preparedById,
      meetingCreated: false as const,
      notificationSent: false as const,
      aiSummaryGenerated: false as const,
      automaticDecision: false as const,
      workflowStarted: false as const,
    };
  }).filter((item): item is GovernanceReviewPreparationMetadata => {
    if (!item || seen.has(item.reviewPreparationId)) return false;
    seen.add(item.reviewPreparationId);
    return true;
  });
}

async function getEditableJourney(formTemplateId: string, ownerId: string) {
  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    include: {
      relationTemplate: {
        include: {
          workspace: { select: { ownerId: true } },
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
      },
    },
  });
  const relationTemplate = formTemplate?.relationTemplate;
  const latestVersion = relationTemplate?.versions[0];
  if (!formTemplate || !relationTemplate || !latestVersion) throw new Error("Parcours introuvable.");

  const snapshot = asRecord(latestVersion.snapshot);
  const metadata = asRecord(snapshot.metadata);
  const metadataOwnerId = optionalText(metadata.createdById);
  if (metadataOwnerId !== ownerId && relationTemplate.workspace?.ownerId !== ownerId) {
    throw new Error("Parcours introuvable.");
  }
  return { formTemplate, latestVersion, snapshot, metadata };
}

export async function prepareGovernanceReviewAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const reviewReason = textFromForm(formData, "reviewReason");
  const reviewQuestion = textFromForm(formData, "reviewQuestion");
  const optionalNote = textFromForm(formData, "optionalNote");
  if (!formTemplateId || !reviewReason || !reviewQuestion) throw new Error("Informations de revue incompletes.");

  const { formTemplate, latestVersion, snapshot, metadata } = await getEditableJourney(formTemplateId, owner.id);
  const currentReviewPreparations = existingReviewPreparations(metadata.governanceReviewPreparations);
  const now = new Date().toISOString();
  const preparedReview: GovernanceReviewPreparationMetadata = {
    reviewPreparationId: `review-prepared-${randomUUID()}`,
    status: "PREPARED_NOT_STARTED",
    reason: reviewReason,
    question: reviewQuestion,
    note: optionalNote || null,
    preparedAt: now,
    startedAt: null,
    completedAt: null,
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
    data: { snapshot: { ...snapshot, metadata: { ...metadata, governanceReviewPreparations: [...currentReviewPreparations, preparedReview] } } as Prisma.InputJsonObject },
  });
  const path = `/gouvernance/parcours/${formTemplate.id}/pilotage`;
  revalidatePath(path);
  redirect(path);
}

export async function transitionGovernanceReviewAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const reviewPreparationId = textFromForm(formData, "reviewPreparationId");
  const nextStatus = textFromForm(formData, "nextStatus");
  if (textFromForm(formData, "humanConfirmed") !== "yes") throw new Error("Confirmation humaine requise.");
  if (!formTemplateId || !reviewPreparationId || (nextStatus !== "IN_HUMAN_REVIEW" && nextStatus !== "COMPLETED")) {
    throw new Error("Transition de revue invalide.");
  }

  const { formTemplate, latestVersion, snapshot, metadata } = await getEditableJourney(formTemplateId, owner.id);
  const reviews = existingReviewPreparations(metadata.governanceReviewPreparations);
  const current = reviews.find((review) => review.reviewPreparationId === reviewPreparationId);
  if (!current) throw new Error("Revue introuvable.");
  const allowed = (current.status === "PREPARED_NOT_STARTED" && nextStatus === "IN_HUMAN_REVIEW")
    || (current.status === "IN_HUMAN_REVIEW" && nextStatus === "COMPLETED");
  if (!allowed) throw new Error("Transition de revue non autorisee.");

  const now = new Date().toISOString();
  const updatedReviews = reviews.map((review): GovernanceReviewPreparationMetadata => review.reviewPreparationId === reviewPreparationId ? {
    ...review,
    status: nextStatus,
    startedAt: nextStatus === "IN_HUMAN_REVIEW" ? now : review.startedAt,
    completedAt: nextStatus === "COMPLETED" ? now : review.completedAt,
    updatedAt: now,
  } : review);

  await prisma.templateVersion.update({
    where: { id: latestVersion.id },
    data: { snapshot: { ...snapshot, metadata: { ...metadata, governanceReviewPreparations: updatedReviews } } as Prisma.InputJsonObject },
  });
  const path = `/gouvernance/parcours/${formTemplate.id}/pilotage`;
  revalidatePath(path);
  redirect(`${path}#governance-review-${encodeURIComponent(reviewPreparationId)}`);
}