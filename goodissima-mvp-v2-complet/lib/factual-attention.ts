import { prisma } from "@/lib/prisma";
import { businessLabel } from "@/lib/spatial-navigation";

export type FactualAlert = { id: string; type: "WAITING_OWNER" | "REVIEWING"; object: "Dossier"; label: string; reason: string; href: string };
export type FactualAttention = { items: FactualAlert[]; hasMore: boolean };
export function attentionPage(value: unknown): number {
  return typeof value === "string" && /^\d{1,5}$/.test(value) ? Number(value) : 0;
}

/** Internal server projection. Callers supply the authenticated Prisma user.
 * Status is the signal; creation age, priority, AI and Workspace membership are
 * not evidence. Same owner proof as /cases/[caseId], rechecked there on opening.
 */
export async function getFactualAttention(ownerId: string, page = 0, size: 3 | 20 = 20): Promise<FactualAttention> {
  if (!ownerId) throw new Error("Authenticated owner required");
  const limit = size === 3 ? 3 : 20;
  const rows = await prisma.relationCase.findMany({
    where: { ownerId, status: { in: ["WAITING_OWNER", "REVIEWING"] }, governanceStatus: "ACTIVE", closedAt: null },
    orderBy: { id: "asc" }, skip: attentionPage(String(page)) * limit, take: limit + 1,
    select: { id: true, candidateName: true, status: true },
  });
  return { hasMore: rows.length > limit, items: rows.slice(0, limit).map(row => ({
    id: row.id, type: row.status as FactualAlert["type"], object: "Dossier",
    label: businessLabel(row.candidateName, "Dossier", [row.id]),
    reason: row.status === "WAITING_OWNER" ? "Ce dossier est marqué « En attente propriétaire »." : "Ce dossier est marqué « À vérifier ».",
    href: `/cases/${encodeURIComponent(row.id)}`,
  })) };
}
