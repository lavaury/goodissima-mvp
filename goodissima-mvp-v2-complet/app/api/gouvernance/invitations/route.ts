import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createJourneyInvitationToken, hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";

const roles = new Set(["EXPERT", "JUDGE", "THIRD_PARTY", "ASSOCIATION", "FAMILY", "OBSERVER", "OTHER"]);

export async function POST(request: Request) {
  const owner = await getCurrentPrismaUser();
  const body = await request.json();
  const formTemplateId = typeof body.formTemplateId === "string" ? body.formTemplateId : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const participantName = typeof body.participantName === "string" ? body.participantName.trim() : displayName;
  const participantRole = typeof body.participantRole === "string" ? body.participantRole.trim() : "";
  const preparedEmail = typeof body.preparedEmail === "string" && body.preparedEmail.trim() ? body.preparedEmail.trim() : null;
  const relationCaseId = typeof body.relationCaseId === "string" && body.relationCaseId.trim() ? body.relationCaseId.trim() : null;
  const role = roles.has(body.role) ? body.role : "OTHER";
  const expiresInDays = Math.min(30, Math.max(1, Number(body.expiresInDays) || 7));
  const form = await prisma.formTemplate.findFirst({
    where: { id: formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } },
    select: { relationTemplate: { select: { id: true, workspaceId: true } } },
  });
  if (!form?.relationTemplate || !displayName) return NextResponse.json({ error: "Parcours ou invité invalide." }, { status: 400 });

  if (relationCaseId) {
    const allowedCase = await prisma.relationCase.findFirst({ where: { id: relationCaseId, ownerId: owner.id, templateId: form.relationTemplate.id }, select: { id: true } });
    if (!allowedCase) return NextResponse.json({ error: "Dossier relationnel non autorisé pour ce parcours." }, { status: 400 });
  }

  const existing = await prisma.governedJourneyInvitation.findFirst({
    where: {
      ownerId: owner.id,
      relationTemplateId: form.relationTemplate.id,
      displayName,
      status: "ACTIVE",
      accessTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Un accès actif existe déjà pour ce participant. Révoquez-le avant d’en créer un nouveau." },
      { status: 409 },
    );
  }

  const token = createJourneyInvitationToken();
  const invitation = await prisma.governedJourneyInvitation.create({ data: {
    ownerId: owner.id, workspaceId: form.relationTemplate.workspaceId, relationTemplateId: form.relationTemplate.id, relationCaseId,
    displayName, role, status: "ACTIVE", accessTokenHash: hashJourneyInvitationToken(token),
    accessTokenExpiresAt: new Date(Date.now() + expiresInDays * 86400000),
    metadata: {
      participantName,
      participantRole,
      preparedEmail,
      deliveryMode: "MANUAL_OUT_OF_BAND",
      automaticEmailSent: false,
      automaticNotificationSent: false,
      mediaStarted: false,
      liveKitRoomCreated: false,
    },
  }});
  const origin = new URL(request.url).origin;
  return NextResponse.json({ id: invitation.id, link: `${origin}/gouvernance/invitation/${token}` });
}
