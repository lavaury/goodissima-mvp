"use server";

import { Prisma, type GovernedParticipantSelectionEligibility } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { hasCurrentJourneyAccess } from "@/lib/governed-journey-consent";
import { createPendingMeetingRsvp } from "@/lib/governed-meeting-rsvp";
import {
  classifyJourneyMemberEligibility,
  GOVERNED_PARTICIPANT_SELECTION_LIMIT,
  isJourneyMemberSelectable,
  projectJourneyMemberCandidates,
} from "@/lib/governed-meeting-participant-selection";
import { prisma } from "@/lib/prisma";

type ActionResult =
  | { ok: true; kind: "CREATED" | "REVIEW_STARTED" | "DRAFT"; selectionId: string; version: number }
  | { ok: true; kind: "MATERIALIZED"; selectionId: string; version: number; summary: MaterializationSummary }
  | { ok: false; error: string; changedParticipants?: string[]; version?: number };

type MaterializationSummary = {
  retained: number;
  added: number;
  alreadyPresent: number;
  errors: number;
};

type SelectionInput = {
  formTemplateId: string;
  communicationSessionId: string;
  selectionId?: string;
  version?: number;
  selectedItemIds?: string[];
  exclusionReasons?: Record<string, string>;
};

async function loadScope(client: Prisma.TransactionClient | typeof prisma, input: SelectionInput, ownerId: string) {
  const form = await client.formTemplate.findFirst({
    where: { id: input.formTemplateId, relationTemplate: { workspace: { ownerId } } },
    select: { relationTemplateId: true },
  });
  if (!form?.relationTemplateId) throw new Error("Parcours gouverné indisponible.");
  const [journey, session] = await Promise.all([
    client.governedJourney.findFirst({
      where: { relationTemplateId: form.relationTemplateId, authorityUserId: ownerId },
      select: { id: true, relationTemplateId: true },
    }),
    client.communicationSession.findFirst({
      where: { id: input.communicationSessionId, ownerId, relationTemplateId: form.relationTemplateId },
      select: { id: true, ownerId: true, relationTemplateId: true, status: true, expiresAt: true, rsvpRevision: true },
    }),
  ]);
  if (!journey || !session || !session.relationTemplateId) throw new Error("Réunion hors du parcours gouverné.");
  if (session.status === "COMPLETED" || session.status === "CANCELLED" || (session.expiresAt && session.expiresAt <= new Date())) {
    throw new Error("Le périmètre de cette réunion est verrouillé.");
  }
  return { journey, session, relationTemplateId: form.relationTemplateId };
}

async function loadJourneyPopulation(
  client: Prisma.TransactionClient | typeof prisma,
  input: { ownerId: string; relationTemplateId: string; communicationSessionId: string; ownerDisplayName: string; now?: Date },
) {
  const invitations = await client.governedJourneyInvitation.findMany({
    where: { ownerId: input.ownerId, relationTemplateId: input.relationTemplateId },
    include: { consent: true, inviteeUser: { select: { name: true, email: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const meetingParticipants = await client.governedMeetingParticipant.findMany({
    where: { communicationSessionId: input.communicationSessionId },
    select: { id: true, governedJourneyInvitationId: true, status: true },
  });
  const userIds = [...new Set(invitations.flatMap((invitation) => invitation.inviteeUserId ? [invitation.inviteeUserId] : []))];
  const profiles = userIds.length
    ? await client.directoryProfile.findMany({
        where: { status: "PUBLISHED", actorType: "PERSON", deletedAt: null, subjectIdentity: { user: { id: { in: userIds } } } },
        select: { publicName: true, subjectIdentity: { select: { user: { select: { id: true } } } } },
      })
    : [];
  const publicNamesByUserId = new Map(profiles.flatMap((profile) => profile.subjectIdentity.user ? [[profile.subjectIdentity.user.id, profile.publicName] as const] : []));
  return projectJourneyMemberCandidates({
    organizer: { id: input.ownerId, displayName: input.ownerDisplayName },
    invitations,
    meetingParticipants,
    publicNamesByUserId,
    now: input.now,
  });
}

function cockpitPath(formTemplateId: string) {
  return `/gouvernance/parcours/${formTemplateId}/pilotage`;
}

export async function createJourneyMemberSelectionAction(input: SelectionInput): Promise<ActionResult> {
  try {
    const owner = await getCurrentPrismaUser();
    const result = await prisma.$transaction(async (tx) => {
      const scope = await loadScope(tx, input, owner.id);
      const candidates = await loadJourneyPopulation(tx, {
        ownerId: owner.id,
        ownerDisplayName: owner.name || owner.email,
        relationTemplateId: scope.relationTemplateId,
        communicationSessionId: scope.session.id,
      });
      if (candidates.length > GOVERNED_PARTICIPANT_SELECTION_LIMIT) {
        return { ok: false as const, error: "Cette sélection dépasse la limite actuelle de 100 personnes." };
      }
      const selection = await tx.governedParticipantSelection.create({
        data: {
          ownerId: owner.id,
          governedJourneyId: scope.journey.id,
          relationTemplateId: scope.relationTemplateId,
          targetType: "MEETING",
          communicationSessionId: scope.session.id,
          source: "JOURNEY_MEMBERS",
          status: "DRAFT",
          criteria: { source: "JOURNEY_MEMBERS", population: "CURRENT_JOURNEY_MEMBERS" },
          createdByUserId: owner.id,
          items: {
            create: candidates.map((candidate) => ({
              relationTemplateId: scope.relationTemplateId,
              canonicalUserId: candidate.canonicalUserId,
              canonicalInvitationId: candidate.canonicalInvitationId,
              sourceInvitationId: candidate.sourceInvitationId,
              snapshotDisplayName: candidate.displayName,
              observedEligibility: candidate.eligibility,
            })),
          },
          events: { create: { type: "CREATED", actorUserId: owner.id, version: 0, summary: { observed: candidates.length } } },
        },
      });
      return { ok: true as const, kind: "CREATED" as const, selectionId: selection.id, version: selection.version };
    });
    revalidatePath(cockpitPath(input.formTemplateId));
    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Création de la sélection impossible." };
  }
}

function normalizedSelectionInput(input: SelectionInput) {
  if (!input.selectionId || !Number.isInteger(input.version) || (input.version ?? -1) < 0) throw new Error("Sélection invalide.");
  const selectedItemIds = [...new Set(input.selectedItemIds ?? [])];
  if (selectedItemIds.length > GOVERNED_PARTICIPANT_SELECTION_LIMIT) throw new Error("Cette sélection dépasse la limite actuelle de 100 personnes.");
  return { selectionId: input.selectionId, version: input.version!, selectedItemIds };
}

async function loadScopedSelection(tx: Prisma.TransactionClient, input: SelectionInput, ownerId: string) {
  const normalized = normalizedSelectionInput(input);
  const scope = await loadScope(tx, input, ownerId);
  const selection = await tx.governedParticipantSelection.findFirst({
    where: {
      id: normalized.selectionId,
      ownerId,
      governedJourneyId: scope.journey.id,
      communicationSessionId: scope.session.id,
      targetType: "MEETING",
      relationTemplateId: scope.relationTemplateId,
      source: "JOURNEY_MEMBERS",
    },
    include: { items: { orderBy: [{ snapshotDisplayName: "asc" }, { id: "asc" }] } },
  });
  if (!selection) throw new Error("Sélection hors du parcours gouverné.");
  return { normalized, scope, selection };
}

async function saveDecisions(
  tx: Prisma.TransactionClient,
  selection: Awaited<ReturnType<typeof loadScopedSelection>>["selection"],
  selectedItemIds: string[],
  exclusionReasons: Record<string, string> = {},
) {
  const allowed = new Set(selection.items.map((item) => item.id));
  if (selectedItemIds.some((id) => !allowed.has(id))) throw new Error("Un candidat ne fait pas partie de cette sélection.");
  const selected = new Set(selectedItemIds);
  const now = new Date();
  for (const item of selection.items) {
    const include = selected.has(item.id);
    if (include && !isJourneyMemberSelectable(item.observedEligibility)) throw new Error(`${item.snapshotDisplayName} n’est pas éligible à cette réunion.`);
    const reason = include ? null : exclusionReasons[item.id]?.trim().slice(0, 500) || null;
    await tx.governedParticipantSelectionItem.update({
      where: { id: item.id },
      data: { decision: include ? "INCLUDED" : "EXCLUDED", decisionReason: reason, decidedAt: now },
    });
  }
}

export async function reviewJourneyMemberSelectionAction(input: SelectionInput): Promise<ActionResult> {
  try {
    const owner = await getCurrentPrismaUser();
    const result = await prisma.$transaction(async (tx) => {
      const loaded = await loadScopedSelection(tx, input, owner.id);
      if (loaded.selection.status !== "DRAFT" || loaded.selection.version !== loaded.normalized.version) throw new Error("Cette sélection a été modifiée. Actualisez avant de poursuivre.");
      await saveDecisions(tx, loaded.selection, loaded.normalized.selectedItemIds, input.exclusionReasons);
      const version = loaded.selection.version + 1;
      const transition = await tx.governedParticipantSelection.updateMany({
        where: { id: loaded.selection.id, status: "DRAFT", version: loaded.selection.version },
        data: { status: "UNDER_REVIEW", reviewStartedAt: new Date(), version },
      });
      if (transition.count !== 1) throw new Error("Cette sélection a été modifiée. Actualisez avant de poursuivre.");
      await tx.governedParticipantSelectionEvent.create({
        data: { selectionId: loaded.selection.id, type: "REVIEW_STARTED", actorUserId: owner.id, version, summary: { retained: loaded.normalized.selectedItemIds.length } },
      });
      return { ok: true as const, kind: "REVIEW_STARTED" as const, selectionId: loaded.selection.id, version };
    });
    revalidatePath(cockpitPath(input.formTemplateId));
    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Examen de la sélection impossible." };
  }
}

export async function returnJourneyMemberSelectionToDraftAction(input: SelectionInput): Promise<ActionResult> {
  try {
    const owner = await getCurrentPrismaUser();
    const result = await prisma.$transaction(async (tx) => {
      const loaded = await loadScopedSelection(tx, input, owner.id);
      if (loaded.selection.status !== "UNDER_REVIEW" || loaded.selection.version !== loaded.normalized.version) throw new Error("Cette sélection a été modifiée. Actualisez avant de poursuivre.");
      const version = loaded.selection.version + 1;
      const transition = await tx.governedParticipantSelection.updateMany({
        where: { id: loaded.selection.id, status: "UNDER_REVIEW", version: loaded.selection.version },
        data: { status: "DRAFT", reviewStartedAt: null, version },
      });
      if (transition.count !== 1) throw new Error("Cette sélection a été modifiée. Actualisez avant de poursuivre.");
      return { ok: true as const, kind: "DRAFT" as const, selectionId: loaded.selection.id, version };
    });
    revalidatePath(cockpitPath(input.formTemplateId));
    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Retour à la sélection impossible." };
  }
}

export async function validateJourneyMemberSelectionAction(input: SelectionInput): Promise<ActionResult> {
  try {
    const owner = await getCurrentPrismaUser();
    const result = await prisma.$transaction(async (tx) => {
      const loaded = await loadScopedSelection(tx, input, owner.id);
      const previousSummary = loaded.selection.materializationSummary as MaterializationSummary | null;
      if (loaded.selection.status === "MATERIALIZED" && previousSummary) {
        return { ok: true as const, kind: "MATERIALIZED" as const, selectionId: loaded.selection.id, version: loaded.selection.version, summary: previousSummary };
      }
      if (loaded.selection.status !== "UNDER_REVIEW" || loaded.selection.version !== loaded.normalized.version) throw new Error("Cette sélection a été modifiée. Actualisez avant de poursuivre.");
      const reservedVersion = loaded.selection.version + 1;
      const reservation = await tx.governedParticipantSelection.updateMany({
        where: { id: loaded.selection.id, status: "UNDER_REVIEW", version: loaded.selection.version },
        data: { status: "VALIDATED", validatedAt: new Date(), validatedByUserId: owner.id, version: reservedVersion },
      });
      if (reservation.count !== 1) throw new Error("Cette sélection a été modifiée. Actualisez avant de poursuivre.");
      await saveDecisions(tx, loaded.selection, loaded.normalized.selectedItemIds, input.exclusionReasons);
      const included = loaded.selection.items.filter((item) => loaded.normalized.selectedItemIds.includes(item.id));
      const [invitations, meetingParticipants] = await Promise.all([
        tx.governedJourneyInvitation.findMany({
          where: { ownerId: owner.id, relationTemplateId: loaded.scope.relationTemplateId },
          include: { consent: true },
        }),
        tx.governedMeetingParticipant.findMany({
          where: { communicationSessionId: loaded.scope.session.id },
          include: { rsvp: true, governedJourneyInvitation: { include: { consent: true } } },
        }),
      ]);
      const invitationsById = new Map(invitations.map((invitation) => [invitation.id, invitation]));
      const revalidated = included.map((item) => {
        const invitation = item.sourceInvitationId ? invitationsById.get(item.sourceInvitationId) : null;
        const identityMatches = Boolean(invitation) && (item.canonicalUserId
          ? invitation!.inviteeUserId === item.canonicalUserId
          : invitation!.inviteeUserId === null && invitation!.id === item.canonicalInvitationId);
        const existing = identityMatches ? meetingParticipants.find((participant) => {
          if (participant.status !== "AUTHORIZED") return false;
          if (participant.governedJourneyInvitationId === invitation!.id) return true;
          return Boolean(item.canonicalUserId)
            && participant.governedJourneyInvitation.inviteeUserId === item.canonicalUserId
            && hasCurrentJourneyAccess(participant.governedJourneyInvitation);
        }) : null;
        const eligibility: GovernedParticipantSelectionEligibility = identityMatches
          ? classifyJourneyMemberEligibility(invitation!, Boolean(existing))
          : "INELIGIBLE";
        return { item, invitation, existing, eligibility };
      });
      const changed = revalidated.filter((entry) => !isJourneyMemberSelectable(entry.eligibility));
      if (changed.length) {
        for (const entry of changed) {
          await tx.governedParticipantSelectionItem.update({
            where: { id: entry.item.id },
            data: { observedEligibility: entry.eligibility, decision: "UNDECIDED", decisionReason: null, decidedAt: null },
          });
        }
        await tx.governedParticipantSelection.update({
          where: { id: loaded.selection.id },
          data: { status: "UNDER_REVIEW", validatedAt: null, validatedByUserId: null, version: reservedVersion },
        });
        return {
          ok: false as const,
          error: "La situation de certains participants a changé depuis votre examen.",
          changedParticipants: changed.map((entry) => entry.item.snapshotDisplayName),
          version: reservedVersion,
        };
      }
      await tx.governedParticipantSelectionEvent.create({
        data: { selectionId: loaded.selection.id, type: "VALIDATED", actorUserId: owner.id, version: reservedVersion, summary: { retained: included.length } },
      });
      let added = 0;
      let alreadyPresent = 0;
      for (const entry of revalidated) {
        let participant = entry.existing;
        const createdBySelection = !participant;
        if (participant) {
          alreadyPresent += 1;
        } else {
          participant = await tx.governedMeetingParticipant.upsert({
            where: { communicationSessionId_governedJourneyInvitationId: { communicationSessionId: loaded.scope.session.id, governedJourneyInvitationId: entry.invitation!.id } },
            create: { communicationSessionId: loaded.scope.session.id, governedJourneyInvitationId: entry.invitation!.id, status: "AUTHORIZED", authorizedById: owner.id },
            update: { status: "AUTHORIZED", authorizedAt: new Date(), removedAt: null, authorizedById: owner.id },
            include: { rsvp: true, governedJourneyInvitation: { include: { consent: true } } },
          });
          added += 1;
        }
        if (createdBySelection && entry.invitation?.consent && !participant.rsvp) {
          await createPendingMeetingRsvp(tx, { meetingParticipantId: participant.id, meetingRevision: loaded.scope.session.rsvpRevision, actorUserId: owner.id });
        }
        await tx.governedParticipantSelectionItem.update({
          where: { id: entry.item.id },
          data: {
            observedEligibility: entry.existing ? "ALREADY_PRESENT" : "ELIGIBLE",
            materializedMeetingParticipantId: createdBySelection ? participant.id : null,
          },
        });
      }
      const summary: MaterializationSummary = { retained: included.length, added, alreadyPresent, errors: 0 };
      const materializedVersion = reservedVersion + 1;
      await tx.governedParticipantSelectionEvent.create({
        data: { selectionId: loaded.selection.id, type: "MATERIALIZED", actorUserId: owner.id, version: materializedVersion, summary },
      });
      await tx.governedParticipantSelection.update({
        where: { id: loaded.selection.id },
        data: { status: "MATERIALIZED", materializedAt: new Date(), materializationSummary: summary, version: materializedVersion },
      });
      return { ok: true as const, kind: "MATERIALIZED" as const, selectionId: loaded.selection.id, version: materializedVersion, summary };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath(cockpitPath(input.formTemplateId));
    return result;
  } catch (error) {
    const technical = error instanceof Error && (/Invalid `?prisma/i.test(error.message) || /Unique constraint failed/i.test(error.message) || error.name.startsWith("PrismaClient"));
    return {
      ok: false,
      error: technical
        ? "La sélection n'a pas pu être validée. Aucun participant n'a été ajouté. Vous pouvez réessayer."
        : error instanceof Error ? error.message : "Validation des participants impossible.",
    };
  }
}
