"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { expectedRolesFromSnapshot } from "@/lib/governed-journey-expected-roles";
import { prisma } from "@/lib/prisma";
import { releaseUnavailableExpectedRoleAssignment } from "@/lib/governed-journey-role-assignments";

const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

export async function assignCurrentUserToExpectedRoleAction(data: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = field(data, "formTemplateId");
  const expectedRoleId = field(data, "expectedRoleId");
  const form = await prisma.formTemplate.findFirst({ where: { id: formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplate: { select: { id: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } }, governedJourney: { where: { authorityUserId: owner.id, status: { notIn: ["CLOSED", "CANCELLED"] } }, take: 1, select: { id: true } } } } } });
  const role = expectedRolesFromSnapshot(form?.relationTemplate?.versions[0]?.snapshot).find(item => item.id === expectedRoleId);
  const journey = form?.relationTemplate?.governedJourney[0];
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

export async function revokeCurrentUserExpectedRoleAction(data: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = field(data, "formTemplateId");
  const assignmentId = field(data, "assignmentId");
  const result = await prisma.governedJourneyExpectedRoleAssignment.updateMany({ where: { id: assignmentId, assigneeUserId: owner.id, revokedAt: null, governedJourney: { authorityUserId: owner.id, formTemplateId } }, data: { revokedAt: new Date(), revokedByUserId: owner.id } });
  if (result.count !== 1) throw new Error("Cette affectation n’est plus disponible.");
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
