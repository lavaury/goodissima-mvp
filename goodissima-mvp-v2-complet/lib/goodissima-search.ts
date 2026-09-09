import { prisma } from "@/lib/prisma";
import { linkObjectLabel } from "@/lib/object-creation";
import { businessLabel } from "@/lib/spatial-navigation";
import { getTemplateCreationProofWhere, resolveTemplateAccess, templateAccessSelect } from "@/lib/relation-template-access";

export const SEARCH_LIMIT = 10;
export function searchTerm(value: unknown): string {
  return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 80 ? value.trim() : "";
}

/** Server-only callers supply the authenticated Prisma user, never a request owner ID.
 * Five bounded queries; no global ID list, per-result lookup or shared result cache.
 * READ candidates use the existing final guard, including contradictory creators.
 */
export async function searchGoodissima(ownerId: string, input: unknown) {
  const query = searchTerm(input);
  if (!ownerId || !query) return { items: [], limited: false };
  // Prisma contains uses LIKE: treat user wildcards as literal characters.
  const contains = query.replace(/[\\%_]/g, "\\$&");
  const text = { contains, mode: "insensitive" as const };
  const window = { take: SEARCH_LIMIT + 1, orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }] };
  const [portfolios, workspaces, links, templates, cases] = await Promise.all([
    prisma.portfolio.findMany({ where: { ownerId, name: text }, ...window, select: { id: true, name: true } }),
    prisma.workspace.findMany({ where: { ownerId, name: text }, ...window, select: { id: true, name: true } }),
    prisma.gLink.findMany({ where: { ownerId, title: text, OR: [
      { rules: { path: ["simpleLink"], equals: true } },
      { rules: { path: ["creationSource"], equals: "opportunity" } },
    ] }, ...window, select: { id: true, title: true, rules: true } }),
    prisma.relationTemplate.findMany({ where: {
      AND: [
        { OR: [{ workspace: { ownerId } }, getTemplateCreationProofWhere(ownerId)] },
        { OR: [{ name: text }, { formTemplates: { some: { name: text } } }] },
      ], formTemplates: { some: {} },
    }, ...window, select: { ...templateAccessSelect, name: true,
      formTemplates: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1, select: { id: true, name: true } },
    } }),
    prisma.relationCase.findMany({ where: { ownerId, candidateName: text }, ...window,
      select: { id: true, candidateName: true } }),
  ]);
  const row = (id: string, name: string, type: string, prefix: string, suffix = "") => ({
    type, title: businessLabel(name, type, [id]), href: `${prefix}${encodeURIComponent(id)}${suffix}`,
  });
  return {
    limited: [portfolios, workspaces, links, templates, cases].some(rows => rows.length > SEARCH_LIMIT),
    items: [
      ...portfolios.slice(0, SEARCH_LIMIT).map(p => row(p.id, p.name, "Portfolio", "/gouvernance/portfolios/")),
      ...workspaces.slice(0, SEARCH_LIMIT).map(w => row(w.id, w.name, "Workspace", "/gouvernance/workspaces/")),
      ...links.slice(0, SEARCH_LIMIT).map(l => row(l.id, l.title, linkObjectLabel(l.rules), "/links/")),
      ...templates.slice(0, SEARCH_LIMIT).filter(t => resolveTemplateAccess(ownerId, t).read).flatMap(t => {
        const form = t.formTemplates[0];
        return form ? [row(form.id, form.name, "Parcours gouverné", "/gouvernance/parcours/", "/pilotage")] : [];
      }),
      ...cases.slice(0, SEARCH_LIMIT).map(c => row(c.id, c.candidateName, "Dossier", "/cases/")),
    ],
  };
}
