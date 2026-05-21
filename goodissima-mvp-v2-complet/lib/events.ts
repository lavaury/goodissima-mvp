import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createRelationEvent(params: {
  caseId: string;
  type: string;
  actorType?: string | null;
  actorId?: string | null;
  payload?: Prisma.InputJsonValue | null;
}) {
  return prisma.relationEvent.create({
    data: {
      caseId: params.caseId,
      type: params.type,
      actorType: params.actorType ?? null,
      actorId: params.actorId ?? null,
      payload: params.payload ?? undefined,
    },
  });
}
