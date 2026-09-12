import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asGLinkRules, projectOpportunity } from "@/lib/opportunities/opportunity-projection";
import { parseOpportunityRulesV1 } from "@/lib/opportunities/contracts";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Object.keys(body).length !== 1 || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const link = await prisma.gLink.findFirst({ where: { id: params.id, ownerId: owner.id }, select: { id: true, slug: true, status: true, rules: true, templateId: true } });
  if (!link) return NextResponse.json({ error: "Opportunité introuvable." }, { status: 404 });
  const projection = projectOpportunity(link);
  if (!projection || projection.legacy || projection.structuredMetadataInvalid || projection.hasGovernedJourney || !projection.type || !projection.structuredCriteria) return NextResponse.json({ error: "Opportunité autonome invalide." }, { status: 409 });
  if (body.enabled && link.status !== "ACTIVE") return NextResponse.json({ error: "Publiez cette opportunité avant d’activer le matching." }, { status: 409 });
  const rules = asGLinkRules(link.rules);
  const opportunity = parseOpportunityRulesV1(rules.opportunity);
  const updatedRules = { ...rules, opportunity: { ...opportunity, matchingEnabled: body.enabled } };
  await prisma.gLink.update({ where: { id: link.id }, data: { rules: updatedRules as Prisma.InputJsonValue } });
  revalidatePath(`/opportunities/${link.id}`); revalidatePath(`/l/${link.slug}`); revalidatePath("/opportunities");
  return NextResponse.json({ matchingEnabled: body.enabled, status: link.status });
}
