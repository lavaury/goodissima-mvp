"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CommunicationChannelType } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveOwnedGovernedJourney } from "@/lib/governed-journey-authority";

const channelTypes = new Set<CommunicationChannelType>(["VOICE_IP", "VIDEO_IP", "SCREEN_SHARE"]);
const COMMUNICATION_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function selectedFormValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function participantInvitationsFrom(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const invitationId = text(row.invitationId);
      const participantName = text(row.participantName);
      const participantRole = text(row.participantRole);
      if (!invitationId || !participantName || !participantRole) return null;

      return {
        invitationId,
        participantName,
        participantRole,
        status: text(row.status) ?? "PREPARED_NOT_SENT",
      };
    })
    .filter((item): item is { invitationId: string; participantName: string; participantRole: string; status: string } => item !== null);
}

function optionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Date de session invalide.");
  return date;
}

function optionalExternalUrl(value: string) {
  if (!value) return null;
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Le lien externe manuel doit etre une URL valide.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Le lien externe manuel doit commencer par http:// ou https://.");
  }

  return url.toString();
}

export async function prepareGovernanceCommunicationSessionAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const workspaceId = textFromForm(formData, "workspaceId");
  const channelTypeInput = textFromForm(formData, "channelType") as CommunicationChannelType;
  const title = textFromForm(formData, "title");
  const purpose = textFromForm(formData, "purpose");
  const note = textFromForm(formData, "note");
  const scheduledAt = optionalDate(textFromForm(formData, "scheduledAt"));
  const externalUrl = optionalExternalUrl(textFromForm(formData, "externalUrl"));

  if (!formTemplateId || !title) {
    throw new Error("Le parcours et le titre sont obligatoires.");
  }

  if (!channelTypes.has(channelTypeInput)) {
    throw new Error("Type de communication invalide.");
  }

  const scope = await resolveOwnedGovernedJourney(prisma, { formTemplateId, authorityUserId: owner.id });
  const formTemplate = scope ? await prisma.formTemplate.findUnique({
      where: { id: formTemplateId },
      include: {
        relationTemplate: {
          include: {
            versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } },
          },
        },
      },
    }) : null;
  if (!formTemplate?.relationTemplate || !scope || ["CLOSED", "CANCELLED"].includes(scope.status)) {
    throw new Error("Parcours gouverne introuvable.");
  }
  if (workspaceId && workspaceId !== scope.workspaceId) throw new Error("Workspace cible invalide pour ce parcours.");

  await prisma.communicationSession.create({
    data: {
      ownerId: owner.id,
      workspaceId: scope.workspaceId,
      relationTemplateId: formTemplate.relationTemplate!.id,
      channelType: channelTypeInput,
      provider: externalUrl ? "MANUAL_EXTERNAL" : "NONE",
      status: "PREPARED_NOT_STARTED",
      title,
      purpose: purpose || null,
      note: note || null,
      externalUrl,
      scheduledAt,
      expiresAt: new Date(Date.now() + COMMUNICATION_SESSION_TTL_MS),
      transcriptionRequested: false,
      transcriptionConsented: false,
      recordingEnabled: false,
      automaticNotificationSent: false,
      tokenGenerated: false,
      accessOpened: false,
      workflowStarted: false,
    },
  });

  revalidatePath("/gouvernance");
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}

export async function prepareGovernanceMultiActorCommunicationAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const workspaceId = textFromForm(formData, "workspaceId");
  const channelTypeInput = textFromForm(formData, "channelType") as CommunicationChannelType;
  const title = textFromForm(formData, "title");
  const purpose = textFromForm(formData, "purpose");
  const note = textFromForm(formData, "note");
  const scheduledAt = optionalDate(textFromForm(formData, "scheduledAt"));
  const participantInvitationIds = selectedFormValues(formData, "participantInvitationIds");

  if (!formTemplateId || !title) {
    throw new Error("Le parcours et le titre sont obligatoires.");
  }

  if (!channelTypes.has(channelTypeInput)) {
    throw new Error("Type de communication invalide.");
  }

  const scope = await resolveOwnedGovernedJourney(prisma, { formTemplateId, authorityUserId: owner.id });
  const formTemplate = scope ? await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    include: { relationTemplate: { include: { versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } } } },
  }) : null;
  if (!formTemplate?.relationTemplate || !scope || ["CLOSED", "CANCELLED"].includes(scope.status)) throw new Error("Parcours gouverne introuvable.");
  if (workspaceId && workspaceId !== scope.workspaceId) throw new Error("Workspace cible invalide pour ce parcours.");
  const latestVersion = formTemplate.relationTemplate.versions[0];
  const metadata = asRecord(asRecord(latestVersion?.snapshot).metadata);
  const participantInvitations = participantInvitationsFrom(metadata.participantInvitations);
  const selectedInvitationIdSet = new Set(participantInvitationIds);
  const selectedInvitations = participantInvitations.filter((invitation) =>
    selectedInvitationIdSet.has(invitation.invitationId),
  );
  const expectedParticipants = selectedInvitations;
  const participantSummary =
    expectedParticipants.length > 0
      ? expectedParticipants
          .map((participant) => `${participant.participantName} (${participant.participantRole})`)
          .join(", ")
      : "Aucun participant prepare dans metadata au moment de la preparation.";
  const governanceNote = [
    "source: governance-multi-actor-v1",
    "Transport multi-acteurs distant non demarre par cette preparation.",
    `participantInvitationIds: ${
      expectedParticipants.length > 0
        ? expectedParticipants.map((participant) => participant.invitationId).join(", ")
        : "aucun"
    }`,
    `participants attendus: ${participantSummary}`,
    note ? `note: ${note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const normalizedSelection = expectedParticipants.map((participant) => participant.invitationId).sort();
  const duplicateCandidates = await prisma.communicationSession.findMany({ where: { ownerId: owner.id, relationTemplateId: formTemplate.relationTemplate.id, channelType: channelTypeInput, title, purpose: purpose || null, status: { in: ["PREPARED_NOT_STARTED", "REQUESTED"] } }, select: { id: true, metadata: true }, orderBy: { createdAt: "desc" }, take: 10 });
  const duplicate = duplicateCandidates.find((candidate) => {
    const candidateMetadata = asRecord(candidate.metadata);
    const ids = Array.isArray(candidateMetadata.selectedParticipantInvitationIds) ? candidateMetadata.selectedParticipantInvitationIds.filter((id): id is string => typeof id === "string").sort() : [];
    return ids.length === normalizedSelection.length && ids.every((id, index) => id === normalizedSelection[index]);
  });
  if (duplicate && textFromForm(formData, "forceCreate") !== "true") redirect(`/gouvernance/parcours/${formTemplateId}/pilotage?similarMeetingId=${duplicate.id}#meeting-${duplicate.id}`);

  const activeGovernedInvitations = await prisma.governedJourneyInvitation.findMany({ where: { ownerId: owner.id, relationTemplateId: formTemplate.relationTemplate.id, status: "ACTIVE", revokedAt: null, accessTokenExpiresAt: { gt: new Date() }, OR: [{ consent: { is: null } }, { consent: { is: { status: "ACCEPTED" } } }] }, include: { consent: true } });
  const governedInvitationByPreparedId = new Map(expectedParticipants.map((participant) => {
    const access = activeGovernedInvitations.find((invitation) => {
      const accessMetadata = asRecord(invitation.metadata);
      return text(accessMetadata.participantName)?.toLocaleLowerCase("fr") === participant.participantName.toLocaleLowerCase("fr") && text(accessMetadata.participantRole)?.toLocaleLowerCase("fr") === participant.participantRole.toLocaleLowerCase("fr");
    });
    return [participant.invitationId, access] as const;
  }));
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.communicationSession.create({ data: {
      ownerId: owner.id,
      workspaceId: scope.workspaceId,
      relationTemplateId: formTemplate.relationTemplate!.id,
      relationCaseId: null,
      channelType: channelTypeInput,
      provider: "NONE",
      status: "PREPARED_NOT_STARTED",
      title,
      purpose: purpose || null,
      note: governanceNote,
      externalUrl: null,
      scheduledAt,
      expiresAt: null,
      transcriptionRequested: false,
      transcriptionConsented: false,
      recordingEnabled: false,
      automaticNotificationSent: false,
      tokenGenerated: false,
      accessOpened: false,
      workflowStarted: false,
      metadata: { source: "governance-multi-actor-v1", selectedParticipantInvitationIds: normalizedSelection, selectedParticipants: expectedParticipants },
    } });
    const authorizedInvitations = Array.from(governedInvitationByPreparedId.values()).filter((invitation): invitation is NonNullable<typeof invitation> => Boolean(invitation));
    for (const invitation of authorizedInvitations) {
      const participant = await tx.governedMeetingParticipant.create({ data: { communicationSessionId: created.id, governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", authorizedById: owner.id } });
      if (invitation.consent) {
        const rsvp = await tx.governedMeetingRsvp.create({ data: { meetingParticipantId: participant.id, status: "PENDING", meetingRevision: created.rsvpRevision } });
        await tx.governedMeetingRsvpEvent.create({ data: { meetingParticipantId: participant.id, rsvpId: rsvp.id, type: "INVITED", actorUserId: owner.id, actorKind: "ORGANIZER", rsvpVersion: rsvp.version, meetingRevision: created.rsvpRevision } });
      }
    }
    return created;
  });

  revalidatePath("/gouvernance");
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
  redirect(`/gouvernance/parcours/${formTemplateId}/pilotage?meetingPrepared=${encodeURIComponent(title)}#meeting-${session.id}`);
}

export const prepareGovernedMultiActorCommunicationAction = prepareGovernanceMultiActorCommunicationAction;
