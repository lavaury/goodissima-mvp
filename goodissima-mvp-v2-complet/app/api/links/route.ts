import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { sendSecureLinkCreatedEmail } from "@/lib/email";
import { getRelationTemplateForLink } from "@/lib/relation-templates";
import { getActiveTemplateVersion } from "@/lib/template-snapshots";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const owner = await getCurrentPrismaUser();
  const relationTemplate = await getRelationTemplateForLink(
    typeof body.templateId === "string" ? body.templateId : null,
  );
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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (body.suppressNotification !== true) {
    await sendSecureLinkCreatedEmail({
      ownerEmail: owner.email,
      linkTitle: link.title,
      publicUrl: `${appUrl}/l/${encodeURIComponent(link.slug)}`,
    });
  }

  return NextResponse.json(link, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
