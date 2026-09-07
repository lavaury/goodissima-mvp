import { prisma } from "@/lib/prisma";

export type DashboardActivity = { id: string; label: string; context: string; date: Date; href: string };
const limit = 5;
export async function getDashboardActivity(ownerId: string): Promise<DashboardActivity[]> {
  const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const [links, cases, documents] = await Promise.all([
    prisma.gLink.findMany({ where: { ownerId }, orderBy, take: limit,
      select: { id: true, title: true, createdAt: true } }),
    prisma.relationCase.findMany({ where: { ownerId }, orderBy, take: limit,
      select: { id: true, createdAt: true, gLink: { select: { title: true } } } }),
    prisma.document.findMany({ where: { relationCase: { ownerId } }, orderBy, take: limit,
      select: { id: true, createdAt: true, relationCase: { select: { id: true, gLink: { select: { title: true } } } } } }),
  ]);
  return [
    ...links.map(item => ({ id: `link-${item.id}`, label: "Lien créé", context: item.title, date: item.createdAt, href: `/links/${encodeURIComponent(item.id)}` })),
    ...cases.map(item => ({ id: `case-${item.id}`, label: "Dossier ouvert", context: item.gLink.title, date: item.createdAt, href: `/cases/${encodeURIComponent(item.id)}` })),
    ...documents.map(item => ({ id: `document-${item.id}`, label: "Document déposé", context: item.relationCase.gLink.title, date: item.createdAt, href: `/cases/${encodeURIComponent(item.relationCase.id)}` })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime() || b.id.localeCompare(a.id)).slice(0, limit);
}
