import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canPublishLink, canTransitionLinkStatus, type LinkLifecycleStatus } from "@/lib/link-lifecycle";
import { buildOpportunityRulesV1, projectOpportunity } from "@/lib/opportunities/opportunity-projection";
import { parseOpportunityCriteriaV1 } from "@/lib/opportunities/contracts";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const link = await prisma.gLink.findFirst({ where: { id: params.id, ownerId: owner.id }, select: { id: true, slug: true, status: true, expiresAt: true, rules: true, templateId: true } });
  if (!link) return NextResponse.json({ error: "Opportunité introuvable." }, { status: 404 });
  const projection = projectOpportunity(link);
  if (!projection || projection.legacy || projection.hasGovernedJourney) return NextResponse.json({ error: "Opportunité autonome invalide." }, { status: 409 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const action = typeof body.action === "string" ? body.action : "update";
  const status = link.status as LinkLifecycleStatus;
  let target: LinkLifecycleStatus | null = action === "publish" || action === "resume" ? "ACTIVE" : action === "suspend" ? "DISABLED" : action === "archive" ? "ARCHIVED" : null;
  if (target) {
    const allowed = target === "ACTIVE" ? canPublishLink({ status, expiresAt: link.expiresAt }, new Date()) : canTransitionLinkStatus(status, target);
    if (!allowed) return NextResponse.json({ error: "Cette transition n’est pas autorisée dans l’état actuel." }, { status: 409 });
    await prisma.gLink.update({ where: { id: link.id }, data: { status: target } });
    revalidate(link.id, link.slug);
    return NextResponse.json({ status: target });
  }
  if (action !== "update") return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!title || title.length > 200 || description.length > 3000) return NextResponse.json({ error: "Vérifiez le titre et la description." }, { status: 400 });
  const expiresAt = body.expiresAt === null || body.expiresAt === "" ? null : typeof body.expiresAt === "string" ? new Date(`${body.expiresAt}T23:59:59.999Z`) : undefined;
  if (expiresAt === undefined || (expiresAt && !Number.isFinite(expiresAt.getTime()))) return NextResponse.json({ error: "Date d’expiration invalide." }, { status: 400 });
  const data: Prisma.GLinkUpdateInput = { title, description: description || null };
  if (status === "DRAFT") {
    if (body.type !== "NEED" && body.type !== "OFFER") return NextResponse.json({ error: "Type invalide." }, { status: 400 });
    try {
      const criteria = parseOpportunityCriteriaV1(body.criteria);
      data.rules = buildOpportunityRulesV1(link.rules, { type: body.type, criteria }) as Prisma.InputJsonValue;
      data.city = criteria.locations?.[0] ?? null; data.expiresAt = expiresAt;
    } catch { return NextResponse.json({ error: "Critères invalides." }, { status: 400 }); }
  }
  await prisma.gLink.update({ where: { id: link.id }, data }); revalidate(link.id, link.slug);
  return NextResponse.json({ status, updated: true });
}

function revalidate(id: string, slug: string) {
  revalidatePath(`/opportunities/${id}`); revalidatePath(`/l/${slug}`); revalidatePath("/opportunities"); revalidatePath("/gouvernance");
}
