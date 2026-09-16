import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  const directoryPublicId = typeof body.directoryPublicId === "string" && body.directoryPublicId.trim() ? body.directoryPublicId.trim() : null;
  const relationCaseId = typeof body.relationCaseId === "string" && body.relationCaseId.trim() ? body.relationCaseId.trim() : null;
  const role = roles.has(body.role) ? body.role : "OTHER";
  const expiresInDays = Math.min(30, Math.max(1, Number(body.expiresInDays) || 7));
  const form = await prisma.formTemplate.findFirst({
    where: { id: formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } },
    select: { relationTemplate: { select: { id: true, workspaceId: true } } },
  });
  const directoryProfile = directoryPublicId
    ? await prisma.directoryProfile.findFirst({
        where: { publicId: directoryPublicId, status: "PUBLISHED", deletedAt: null, actorType: "PERSON", subjectIdentity: { user: { isNot: null } } },
        select: { publicId: true, publicName: true, subjectIdentity: { select: { user: { select: { id: true } } } } },
      })
    : null;
  const resolvedDisplayName = directoryProfile?.publicName ?? displayName;
  if (!form?.relationTemplate || !resolvedDisplayName || (directoryPublicId && !directoryProfile?.subjectIdentity.user)) {
    return NextResponse.json({ error: "Parcours ou invité invalide." }, { status: 400 });
  }
  if (directoryProfile?.subjectIdentity.user?.id === owner.id) {
    return NextResponse.json({ error: "L’organisateur participe déjà à ce parcours." }, { status: 409 });
  }
  const relationTemplate = form.relationTemplate;

  if (relationCaseId) {
    const allowedCase = await prisma.relationCase.findFirst({ where: { id: relationCaseId, ownerId: owner.id, templateId: form.relationTemplate.id }, select: { id: true } });
    if (!allowedCase) return NextResponse.json({ error: "Dossier relationnel non autorisé pour ce parcours." }, { status: 400 });
  }

  const duplicateWhere = {
      ownerId: owner.id,
      relationTemplateId: relationTemplate.id,
      ...(directoryPublicId
        ? { OR: [{ inviteeUserId: directoryProfile?.subjectIdentity.user?.id }, { metadata: { path: ["directoryPublicId"], equals: directoryPublicId } }] }
        : { displayName: resolvedDisplayName }),
      status: { in: ["PREPARED", "ACTIVE"] },
      accessTokenExpiresAt: { gt: new Date() },
  } satisfies Prisma.GovernedJourneyInvitationWhereInput;

  const token = createJourneyInvitationToken();
  const invitation = await prisma.$transaction(async (tx) => {
    const existing = await tx.governedJourneyInvitation.findFirst({ where: duplicateWhere, select: { id: true } });
    if (existing) return null;
    const created = await tx.governedJourneyInvitation.create({ data: {
      ownerId: owner.id, workspaceId: relationTemplate.workspaceId, relationTemplateId: relationTemplate.id, relationCaseId,
      displayName: resolvedDisplayName, role, status: "PREPARED", inviteeUserId: directoryProfile?.subjectIdentity.user?.id ?? null,
      accessTokenHash: hashJourneyInvitationToken(token), accessTokenExpiresAt: new Date(Date.now() + expiresInDays * 86400000),
      metadata: {
        participantName: participantName || resolvedDisplayName, participantRole, preparedEmail, directoryPublicId,
        subjectUserId: directoryProfile?.subjectIdentity.user?.id ?? null,
        deliveryMode: "MANUAL_OUT_OF_BAND", automaticEmailSent: false, automaticNotificationSent: false,
        mediaStarted: false, liveKitRoomCreated: false,
      },
    }});
    const consent = await tx.governedJourneyConsent.create({ data: { invitationId: created.id, status: "PENDING" } });
    await tx.governedJourneyConsentEvent.create({ data: {
      invitationId: created.id, consentId: consent.id, type: "CREATED", actorUserId: owner.id,
      actorKind: "OWNER", occurredAt: new Date(), consentVersion: consent.version, roleSnapshot: created.role,
    }});
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return null;
    throw error;
  });
  if (!invitation) {
    return NextResponse.json(
      { error: "Un accès actif existe déjà pour ce participant. Révoquez-le avant d’en créer un nouveau." },
      { status: 409 },
    );
  }
  const origin = new URL(request.url).origin;
  return NextResponse.json({ id: invitation.id, link: `${origin}/gouvernance/invitation/${token}` });
}
