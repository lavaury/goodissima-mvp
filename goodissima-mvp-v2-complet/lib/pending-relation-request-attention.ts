import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { relationRequestOwnerHref } from "@/lib/opportunities/opportunity-projection";

const MAX_PENDING_ATTENTION = 500;

export type PendingRelationRequestAttention = {
  kind: "RELATION_REQUEST_ATTENTION";
  requestId: string;
  gLinkId: string;
  title: string;
  candidateName: string | null;
  createdAt: Date;
  href: string;
};

function candidateNameFromPayload(value: Prisma.JsonValue | null): string | null | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const payload = value as Record<string, unknown>;
  if (typeof payload.candidateName !== "string" || typeof payload.candidateEmail !== "string") return undefined;
  return payload.candidateName.trim() || null;
}

/** Server-only projection. Ownership is derived from GLink; client-provided ids never participate. */
export async function getPendingRelationRequestAttentionForUser(userId: string): Promise<PendingRelationRequestAttention[]> {
  const rows = await prisma.publicCaseCreationRequest.findMany({
    where: { status: "PENDING", gLink: { ownerId: userId }, requestPayload: { not: Prisma.DbNull } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_PENDING_ATTENTION,
    select: { id: true, gLinkId: true, requestPayload: true, createdAt: true, gLink: { select: { id: true, title: true, rules: true, templateId: true } } },
  });
  return rows.flatMap((row) => {
    const candidateName = candidateNameFromPayload(row.requestPayload);
    return candidateName === undefined ? [] : [{
      kind: "RELATION_REQUEST_ATTENTION" as const,
      requestId: row.id,
      gLinkId: row.gLinkId,
      title: row.gLink.title,
      candidateName,
      createdAt: row.createdAt,
      href: relationRequestOwnerHref(row.gLink, row.id),
    }];
  });
}
