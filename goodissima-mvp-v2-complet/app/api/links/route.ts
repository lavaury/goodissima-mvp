import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { sendSecureLinkCreatedEmail } from "@/lib/email";
import { getTemplateForLinkCreation } from "@/lib/relation-template-access";
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
  if (body.templateId != null && (typeof body.templateId !== "string" || !body.templateId.trim())) {
    return NextResponse.json({ error: "Template invalide." }, { status: 400 });
  }
  const relationTemplate = await getTemplateForLinkCreation(owner, body.templateId ?? null);
  if (!relationTemplate) return NextResponse.json({ error: "Parcours introuvable." }, { status: 404 });
  const templateVersion = relationTemplate ? await getActiveTemplateVersion(relationTemplate.id) : null;
  const slug = `${slugify(body.title)}-${Math.random().toString(36).slice(2, 7)}`;
  const link = await prisma.gLink.create({
    data: {
      ownerId: owner.id,
      templateId: relationTemplate?.id,
      templateVersionId: templateVersion?.id,
      slug,
      title: body.title,
      city: body.city || null,
      description: body.description || null,
      admissionMode: parseSecureLinkAdmissionMode(body.admissionMode),
      rules: {
        requireEmail: Boolean(body.requireEmail),
        requireMessage: Boolean(body.requireMessage),
        allowDocument: Boolean(body.allowDocument),
      },
    },
  });

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
