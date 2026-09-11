import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mergeGLinkRules } from "@/lib/glink-matching";
import { canPublishLink, canTransitionLinkStatus, type LinkLifecycleStatus } from "@/lib/link-lifecycle";

export async function PATCH(req: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const link = await prisma.gLink.findFirst({ where: { id: params.linkId, ownerId: owner.id }, select: { id: true, rules: true, templateId: true, status: true, expiresAt: true } });
  if (!link) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "update";
  if (action === "matching") {
    const matchingEnabled = body.matchingEnabled === true;
    await prisma.gLink.update({
      where: { id: link.id },
      data: {
        rules: mergeGLinkRules(link.rules, {
          matchingEnabled,
          matchingStatus: matchingEnabled ? "TO_ANALYZE" : "DISABLED",
        }) as Prisma.InputJsonValue,
      },
    });
    if (link.templateId) {
      await prisma.aIEvent.create({
        data: {
          templateId: link.templateId, organizationId: owner.id, featureName: "matching_analysis",
          provider: "human", model: "human-opt-in",
          action: matchingEnabled ? "glink_matching_enabled" : "glink_matching_disabled",
          status: "success", promptVersion: "matching-v1.1-glink",
          outputSummary: JSON.stringify({ sourceType: "GLINK", sourceId: link.id, matchingEnabled }),
        },
      });
    }
    revalidatePath(`/links/${link.id}`);
    revalidatePath("/gouvernance/pilotage");
    return NextResponse.json({ matchingEnabled, matchingStatus: matchingEnabled ? "TO_ANALYZE" : "DISABLED", automaticActions: false });
  }
  if (action === "archive") {
    if (!canTransitionLinkStatus(link.status as LinkLifecycleStatus, "ARCHIVED")) {
      return NextResponse.json({ error: "Cette annonce ne peut pas être archivée dans son état actuel." }, { status: 409 });
    }
    await prisma.gLink.update({ where: { id: link.id }, data: { status: "ARCHIVED" } });
    revalidatePath(`/links/${link.id}`);
    revalidatePath("/opportunities", "page");
    revalidatePath("/dashboard");
    return NextResponse.json({ status: "ARCHIVED", archived: true, deleted: false, relationshipsModified: false });
  }
  if (action === "publish") {
    if (!canPublishLink({ status: link.status as LinkLifecycleStatus, expiresAt: link.expiresAt }, new Date())) {
      return NextResponse.json({ error: "Cette annonce ne peut pas être publiée dans son état actuel ou sa date d’expiration est dépassée." }, { status: 409 });
    }
    await prisma.gLink.update({ where: { id: link.id }, data: { status: "ACTIVE" } });
    revalidatePath(`/links/${link.id}`);
    revalidatePath("/opportunities", "page");
    revalidatePath("/dashboard");
    return NextResponse.json({ status: "ACTIVE", published: true, relationshipsModified: false });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Le titre de l'annonce est requis." }, { status: 400 });
  const updated = await prisma.gLink.update({ where: { id: link.id }, data: { title, city: typeof body.city === "string" && body.city.trim() ? body.city.trim().slice(0, 120) : null, description: typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 3000) : null } });
  revalidatePath(`/links/${link.id}`);
  revalidatePath("/opportunities");
  return NextResponse.json({ id: updated.id, title: updated.title, city: updated.city, description: updated.description, relationshipsModified: false });
}
