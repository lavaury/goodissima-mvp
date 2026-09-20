"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { expectedRolesFromSnapshot } from "@/lib/governed-journey-expected-roles";
import { prisma } from "@/lib/prisma";
import { releaseUnavailableExpectedRoleAssignment } from "@/lib/governed-journey-role-assignments";
import { resolveOwnedGovernedJourney } from "@/lib/governed-journey-authority";

const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

export async function assignCurrentUserToExpectedRoleAction(data: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = field(data, "formTemplateId");
  const expectedRoleId = field(data, "expectedRoleId");
  const journey = await resolveOwnedGovernedJourney(prisma, { formTemplateId, authorityUserId: owner.id });
  const form = journey && journey.status !== "CLOSED" && journey.status !== "CANCELLED"
    ? await prisma.formTemplate.findUnique({ where: { id: formTemplateId }, select: { relationTemplate: { select: { id: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } } } } }) : null;
  const role = expectedRolesFromSnapshot(form?.relationTemplate?.versions[0]?.snapshot).find(item => item.id === expectedRoleId);
  if (!form?.relationTemplate || !journey || !role) throw new Error("Rôle attendu non autorisé pour ce parcours.");
  const relationTemplateId = form.relationTemplate.id;
  try {
    await prisma.$transaction(async tx => {
      const now = new Date();
      const current = await releaseUnavailableExpectedRoleAssignment(tx, { governedJourneyId: journey.id, expectedRoleId, actorUserId: owner.id, now });
      if (current?.assigneeUserId === owner.id) return;
      if (current) throw new Error("Ce rôle est déjà associé à une personne.");
      await tx.governedJourneyExpectedRoleAssignment.create({ data: { governedJourneyId: journey.id, relationTemplateId, expectedRoleId, assigneeUserId: owner.id, assignedByUserId: owner.id, assignedAt: now } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) throw new Error("Ce rôle vient d’être associé à une personne. Actualisez la page.");
    throw error;
  }
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}

export async function assignJourneyParticipantToExpectedRoleAction(data: FormData) {
  const owner = await getCurrentPrismaUser();
  const governedJourneyId = field(data, "governedJourneyId");
  const expectedRoleId = field(data, "expectedRoleId");
  const invitationId = field(data, "invitationId");
  const now = new Date();
  const journey = await prisma.governedJourney.findFirst({
    where: { id: governedJourneyId, authorityUserId: owner.id, status: { notIn: ["CLOSED", "CANCELLED"] } },
    select: { id: true, formTemplateId: true, relationTemplateId: true, createdFromTemplateVersion: { select: { snapshot: true } } },
  });
  const role = expectedRolesFromSnapshot(journey?.createdFromTemplateVersion.snapshot).find(item => item.id === expectedRoleId);
  if (!journey || !role) throw new Error("Rôle attendu non autorisé pour ce parcours.");
  const participant = await prisma.governedJourneyInvitation.findFirst({
    where: { id: invitationId, ownerId: owner.id, relationTemplateId: journey.relationTemplateId, status: "ACTIVE", revokedAt: null, accessTokenExpiresAt: { gt: now }, consent: { status: "ACCEPTED" } },
    select: { id: true, inviteeUserId: true },
  });
  if (!participant || participant.inviteeUserId === owner.id) throw new Error("Ce participant actif n’est pas disponible pour ce parcours.");
  try {
    await prisma.$transaction(async tx => {
      const current = await releaseUnavailableExpectedRoleAssignment(tx, { governedJourneyId: journey.id, expectedRoleId, actorUserId: owner.id, now });
      const sameParticipant = participant.inviteeUserId ? current?.assigneeUserId === participant.inviteeUserId : current?.assigneeInvitationId === participant.id;
      if (sameParticipant) return;
      if (current) throw new Error("Ce rôle est déjà associé à une personne.");
      await tx.governedJourneyExpectedRoleAssignment.create({ data: { governedJourneyId: journey.id, relationTemplateId: journey.relationTemplateId, expectedRoleId, assigneeUserId: participant.inviteeUserId, assigneeInvitationId: participant.inviteeUserId ? null : participant.id, assignedByUserId: owner.id, assignedAt: now } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) throw new Error("Ce rôle vient d’être associé à une personne. Actualisez la page.");
    throw error;
  }
  if (journey.formTemplateId) revalidatePath(`/gouvernance/parcours/${journey.formTemplateId}/pilotage`);
}

export async function revokeExpectedRoleAssignmentAction(data: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = field(data, "formTemplateId");
  const assignmentId = field(data, "assignmentId");
  const result = await prisma.governedJourneyExpectedRoleAssignment.updateMany({ where: { id: assignmentId, revokedAt: null, governedJourney: { authorityUserId: owner.id, formTemplateId } }, data: { revokedAt: new Date(), revokedByUserId: owner.id } });
  if (result.count !== 1) throw new Error("Cette affectation n’est plus disponible.");
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
