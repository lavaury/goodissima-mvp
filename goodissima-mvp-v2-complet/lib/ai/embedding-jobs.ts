import { prisma } from "@/lib/prisma";

export type EmbeddingJobTriggerType =
  | "message_created"
  | "document_uploaded"
  | "timeline_updated"
  | "manual_refresh"
  | "template_changed";

export async function enqueueEmbeddingJob({
  relationCaseId,
  triggerType,
}: {
  relationCaseId: string;
  triggerType: EmbeddingJobTriggerType;
}) {
  const pendingExisting = await prisma.embeddingJob.findFirst({
    where: {
      relationCaseId,
      status: { in: ["pending", "processing"] },
    },
    select: { id: true },
  });

  await prisma.relationCase.update({
    where: { id: relationCaseId },
    data: { embeddingStatus: "stale" },
    select: { id: true },
  });

  if (pendingExisting) return pendingExisting;

  return prisma.embeddingJob.create({
    data: {
      relationCaseId,
      triggerType,
      status: "pending",
    },
    select: { id: true },
  });
}
