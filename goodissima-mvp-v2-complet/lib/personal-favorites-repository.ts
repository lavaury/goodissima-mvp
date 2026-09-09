import { prisma } from "@/lib/prisma";
import { linkObjectLabel } from "@/lib/object-creation";
import { businessLabel } from "@/lib/spatial-navigation";
import { getTemplateCreationProofWhere, resolveTemplateAccess, templateAccessSelect } from "@/lib/relation-template-access";
import { favoriteKey, favoritePage, favoriteObjectId, favoriteTarget, type FavoriteTarget } from "@/lib/personal-favorite-target";

export const FAVORITES_PAGE_SIZE = 20;
export type ResolvedFavorite = FavoriteTarget & { title: string; label: string; href: string };

/** Internal server repository. Only authenticated actions supply userId.
 * A page or explicit action resolves at most 20 references, with at most five
 * grouped queries. Favorites are never authorization evidence.
 */
export async function resolveFavorites(userId: string, targets: FavoriteTarget[]): Promise<ResolvedFavorite[]> {
  if (!userId || targets.length > FAVORITES_PAGE_SIZE) throw new Error("Invalid favorite window");
  const ids = (kind: FavoriteTarget["objectKind"]) => targets.filter(t => t.objectKind === kind).map(t => t.objectId);
  const portfolios = ids("PORTFOLIO"), workspaces = ids("WORKSPACE"), links = ids("GLINK"), templates = ids("RELATION_TEMPLATE"), cases = ids("RELATION_CASE");
  const [ps, ws, ls, ts, cs] = await Promise.all([
    portfolios.length ? prisma.portfolio.findMany({ where: { ownerId: userId, id: { in: portfolios } }, take: portfolios.length, select: { id: true, name: true } }) : [],
    workspaces.length ? prisma.workspace.findMany({ where: { ownerId: userId, id: { in: workspaces } }, take: workspaces.length, select: { id: true, name: true } }) : [],
    links.length ? prisma.gLink.findMany({ where: { ownerId: userId, id: { in: links } }, take: links.length, select: { id: true, title: true, rules: true } }) : [],
    templates.length ? prisma.relationTemplate.findMany({ where: { id: { in: templates }, OR: [
      { workspace: { ownerId: userId } }, getTemplateCreationProofWhere(userId),
    ] }, take: templates.length, select: { ...templateAccessSelect,
      formTemplates: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1, select: { id: true, name: true } },
    } }) : [],
    cases.length ? prisma.relationCase.findMany({ where: { ownerId: userId, id: { in: cases } }, take: cases.length, select: { id: true, candidateName: true } }) : [],
  ]);
  const row = (objectKind: FavoriteTarget["objectKind"], objectId: string, title: string, label: string, href: string): ResolvedFavorite =>
    ({ objectKind, objectId, title: businessLabel(title, label, [objectId]), label, href });
  const resolved = [
    ...ps.map(p => row("PORTFOLIO", p.id, p.name, "Portfolio", `/gouvernance/portfolios/${encodeURIComponent(p.id)}`)),
    ...ws.map(w => row("WORKSPACE", w.id, w.name, "Workspace", `/gouvernance/workspaces/${encodeURIComponent(w.id)}`)),
    ...ls.map(l => row("GLINK", l.id, l.title, linkObjectLabel(l.rules), `/links/${encodeURIComponent(l.id)}`)),
    ...ts.filter(t => resolveTemplateAccess(userId, t).read).flatMap(t => {
      const form = t.formTemplates[0];
      return form && favoriteObjectId(form.id) ? [row("RELATION_TEMPLATE", t.id, businessLabel(form.name, "Parcours gouverné", [form.id]), "Parcours gouverné", `/gouvernance/parcours/${encodeURIComponent(form.id)}/pilotage`)] : [];
    }),
    ...cs.map(c => row("RELATION_CASE", c.id, c.candidateName, "Dossier", `/cases/${encodeURIComponent(c.id)}`)),
  ];
  const byKey = new Map(resolved.map(r => [favoriteKey(r), r]));
  return targets.flatMap(t => { const r = byKey.get(favoriteKey(t)); return r ? [r] : []; });
}

export async function readFavoritePage(userId: string, input: unknown) {
  const page = favoritePage(input);
  const rows = await prisma.personalFavorite.findMany({
    where: { userId }, take: FAVORITES_PAGE_SIZE + 1,
    orderBy: [{ createdAt: "desc" }, { objectKind: "asc" }, { objectId: "asc" }],
    skip: page * FAVORITES_PAGE_SIZE,
    select: { objectKind: true, objectId: true },
  });
  const window = rows.slice(0, FAVORITES_PAGE_SIZE);
  return { items: await resolveFavorites(userId, window.flatMap(t => { const parsed = favoriteTarget(t); return parsed ? [parsed] : []; })),
    // Advance by references, including hidden objects, without exposing their IDs.
    hasMore: page < 1000 && rows.length > FAVORITES_PAGE_SIZE, page };
}
