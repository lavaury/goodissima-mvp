import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function auditLog(params: {
  caseId?: string;
  actorEmail?: string;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      caseId: params.caseId,
      actorEmail: params.actorEmail,
      eventType: params.eventType,
      metadata: params.metadata ?? {},
    },
  });
}
