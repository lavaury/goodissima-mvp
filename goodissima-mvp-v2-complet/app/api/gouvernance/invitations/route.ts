import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createJourneyInvitationToken, hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";
import { expectedRolesFromSnapshot } from "@/lib/governed-journey-expected-roles";

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
  const expectedRoleId = typeof body.expectedRoleId === "string" && body.expectedRoleId.trim() ? body.expectedRoleId.trim() : null;
  const relationCaseId = typeof body.relationCaseId === "string" && body.relationCaseId.trim() ? body.relationCaseId.trim() : null;
  const role = roles.has(body.role) ? body.role : "OTHER";
  const expiresInDays = Math.min(30, Math.max(1, Number(body.expiresInDays) || 7));
  const form = await prisma.formTemplate.findFirst({
    where: { id: formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } },
    select: { relationTemplate: { select: { id: true, workspaceId: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } } } },
  });
  const directoryProfile = directoryPublicId
    ? await prisma.directoryProfile.findFirst({
        where: { publicId: directoryPublicId, status: "PUBLISHED", deletedAt: null, actorType: "PERSON", subjectIdentity: { user: { isNot: null } } },
        select: { publicId: true, publicName: true, subjectIdentity: { select: { user: { select: { id: true } } } } },
      })
    : null;
  const resolvedDisplayName = directoryProfile?.publicName ?? displayName;
  const expectedRole = expectedRoleId ? expectedRolesFromSnapshot(form?.relationTemplate?.versions[0]?.snapshot).find((item) => item.id === expectedRoleId) : null;
  if (!form?.relationTemplate || !resolvedDisplayName || (directoryPublicId && !directoryProfile?.subjectIdentity.user)) {
    return NextResponse.json({ error: "Parcours ou invité invalide." }, { status: 400 });
  }
  if (expectedRoleId && !expectedRole) return NextResponse.json({ error: "Rôle attendu inconnu pour ce parcours." }, { status: 400 });
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
    const existing = await tx.governedJourneyInvitation.findFirst({ where: duplicateWhere, select: { id: true, status: true, consent: { select: { status: true } } } });
    if (existing) return null;
    const created = await tx.governedJourneyInvitation.create({ data: {
      ownerId: owner.id, workspaceId: relationTemplate.workspaceId, relationTemplateId: relationTemplate.id, relationCaseId,
      displayName: resolvedDisplayName, role, status: "PREPARED", inviteeUserId: directoryProfile?.subjectIdentity.user?.id ?? null,
      accessTokenHash: hashJourneyInvitationToken(token), accessTokenExpiresAt: new Date(Date.now() + expiresInDays * 86400000),
      metadata: {
        participantName: participantName || resolvedDisplayName, participantRole: expectedRole?.isFallback ? "" : expectedRole?.label ?? participantRole,
        expectedRoleId, expectedRoleContext: expectedRole?.name ?? null, preparedEmail, directoryPublicId,
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
    const existing = await prisma.governedJourneyInvitation.findFirst?.({ where: duplicateWhere, select: { status: true, consent: { select: { status: true } } } });
    const message = existing?.consent?.status === "PENDING"
      ? "Une invitation est déjà en attente pour cette participation."
      : existing?.consent?.status === "ACCEPTED" || existing?.status === "ACTIVE"
        ? "Cette personne participe déjà au parcours."
        : "Une invitation existe déjà pour cette participation.";
    return NextResponse.json(
      { error: message },
      { status: 409 },
    );
  }
  const origin = new URL(request.url).origin;
  return NextResponse.json({ id: invitation.id, link: `${origin}/gouvernance/invitation/${token}` });
}
