import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { sendSecureLinkCreatedEmail } from "@/lib/email";
import { getTemplateForLinkCreation } from "@/lib/relation-template-access";
import { parseCreationWorkspaceId } from "@/lib/object-creation";
import { getActiveTemplateVersion } from "@/lib/template-snapshots";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { parseSecureLinkAdmissionMode } from "@/lib/secure-link-admission";
import { buildPublicAppUrl } from "@/lib/public-app-url";

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const owner = await getCurrentPrismaUser();
  let workspaceId: string | null;
  try { workspaceId = parseCreationWorkspaceId(body.workspaceId); }
  catch { return NextResponse.json({ error: "Workspace invalide." }, { status: 400 }); }
  if (body.templateId != null && (typeof body.templateId !== "string" || !body.templateId.trim())) {
    return NextResponse.json({ error: "Template invalide." }, { status: 400 });
  }
  const relationTemplate = await getTemplateForLinkCreation(owner, body.templateId ?? null);
  if (!relationTemplate) return NextResponse.json({ error: "Parcours introuvable." }, { status: 404 });
  const templateVersion = relationTemplate ? await getActiveTemplateVersion(relationTemplate.id) : null;
  const slug = `${slugify(body.title)}-${Math.random().toString(36).slice(2, 7)}`;
  const link = await prisma.$transaction(async (tx) => {
    if (workspaceId && !await tx.workspace.findFirst({ where: { id: workspaceId, ownerId: owner.id, status: "ACTIVE" }, select: { id: true } })) return null;
    return tx.gLink.create({
    data: {
      ownerId: owner.id,
      workspaceId,
      templateId: relationTemplate?.id,
      templateVersionId: templateVersion?.id,
      slug,
      title: body.title,
      city: body.city || null,
      description: body.description || null,
      admissionMode: parseSecureLinkAdmissionMode(body.admissionMode),
      rules: {
        creationSource: "opportunity",
        requireEmail: Boolean(body.requireEmail),
        requireMessage: Boolean(body.requireMessage),
        allowDocument: Boolean(body.allowDocument),
      },
    },
    });
  });
  if (!link) return NextResponse.json({ error: "Workspace indisponible pour cette création." }, { status: 404 });
  if (workspaceId) revalidatePath(`/gouvernance/workspaces/${encodeURIComponent(workspaceId)}`);
  revalidatePath("/gouvernance");

  await auditLog({
    actorEmail: owner.email,
    eventType: "LINK_CREATED",
    metadata: {
      gLinkId: link.id,
      slug: link.slug,
      templateId: relationTemplate?.id,
      templateVersionId: templateVersion?.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/links/new");
  revalidatePath("/opportunities");

  if (body.suppressNotification !== true) {
    await sendSecureLinkCreatedEmail({
      ownerEmail: owner.email,
      linkTitle: link.title,
      publicUrl: buildPublicAppUrl(`/l/${encodeURIComponent(link.slug)}`),
    });
  }

  return NextResponse.json({ ...link, publicUrl: buildPublicAppUrl(`/l/${encodeURIComponent(link.slug)}`) }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
