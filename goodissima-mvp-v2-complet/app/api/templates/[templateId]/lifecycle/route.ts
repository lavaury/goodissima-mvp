import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { transitionOpportunity, type OpportunityLifecycle } from "@/lib/goodissima-experience";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    if (body.humanConfirmed !== true) return NextResponse.json({ error: "Une confirmation humaine est requise." }, { status: 400 });
    const formTemplate = await prisma.formTemplate.findUnique({ where: { id: params.templateId }, include: { relationTemplate: true } });
    if (!formTemplate?.relationTemplate) return NextResponse.json({ error: "Opportunité introuvable." }, { status: 404 });
    const current = formTemplate.relationTemplate.status as OpportunityLifecycle;
    const requested = body.status as OpportunityLifecycle;
    const next = transitionOpportunity(current, requested, true);
    await prisma.$transaction([
      prisma.relationTemplate.update({ where: { id: formTemplate.relationTemplate.id }, data: { status: next } }),
      prisma.aIEvent.create({
        data: {
          userId: owner.id,
          organizationId: owner.id,
          organizationName: owner.name ?? owner.email,
          templateId: formTemplate.relationTemplate.id,
          provider: "human",
          model: "goodissima-experience-v1",
          action: "opportunity_lifecycle_changed",
          status: "success",
          promptVersion: "IA-4A-UX-01",
          outputSummary: `${current}->${next}`,
        },
      }),
    ]);
    return NextResponse.json({ status: next });
  } catch (error) {
    const message = error instanceof Error && error.message === "INVALID_OPPORTUNITY_TRANSITION" ? "Transition de statut invalide." : "Impossible de modifier le statut.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
