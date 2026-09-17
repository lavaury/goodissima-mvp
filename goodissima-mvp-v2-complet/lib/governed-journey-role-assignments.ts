import type { Prisma } from "@prisma/client";

export type ExpectedRoleAssignmentProjection = "UNASSIGNED" | "PENDING_INVITATION" | "ASSIGNED";
export type ProjectableExpectedRoleAssignment = { id: string; expectedRoleId: string; assigneeUserId: string | null; revokedAt: Date | null; assigneeUser?: { id: string; name: string | null; email: string } | null; assigneeInvitation?: { id: string; displayName: string; status: string; revokedAt: Date | null; accessTokenExpiresAt: Date; consent?: { status: string } | null } | null };

export function projectExpectedRoleAssignment(assignment: ProjectableExpectedRoleAssignment | undefined, now = new Date()): ExpectedRoleAssignmentProjection {
  if (!assignment || assignment.revokedAt) return "UNASSIGNED";
  if (assignment.assigneeUserId) return "ASSIGNED";
  const invitation = assignment.assigneeInvitation;
  if (!invitation || invitation.revokedAt || invitation.status === "REVOKED" || invitation.accessTokenExpiresAt <= now || invitation.consent?.status === "DECLINED") return "UNASSIGNED";
  return invitation.consent?.status === "ACCEPTED" && invitation.status === "ACTIVE" ? "ASSIGNED" : "PENDING_INVITATION";
}

export async function releaseUnavailableExpectedRoleAssignment(tx: Prisma.TransactionClient, input: { governedJourneyId: string; expectedRoleId: string; actorUserId: string; now: Date }) {
  const current = await tx.governedJourneyExpectedRoleAssignment.findFirst({ where: { governedJourneyId: input.governedJourneyId, expectedRoleId: input.expectedRoleId, revokedAt: null }, include: { assigneeInvitation: { include: { consent: true } } } });
  if (!current || projectExpectedRoleAssignment(current, input.now) !== "UNASSIGNED") return current;
  await tx.governedJourneyExpectedRoleAssignment.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: input.now, revokedByUserId: input.actorUserId } });
  return null;
}
