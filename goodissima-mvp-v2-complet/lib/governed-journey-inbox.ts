import { prisma } from "@/lib/prisma";
import { getGovernedInvitationRoleLabel } from "@/lib/governed-invitation-role-label";
import { projectJourneyParticipationState } from "@/lib/governed-journey-consent";

export async function getReceivedJourneyInvitations(userId: string, now = new Date()) {
  const invitations = await prisma.governedJourneyInvitation.findMany({
    where: { inviteeUserId: userId },
    include: { consent: true, relationTemplate: { select: { name: true, description: true } } },
    orderBy: { createdAt: "desc" },
  });
  const owners = await prisma.user.findMany({ where: { id: { in: [...new Set(invitations.map((item) => item.ownerId))] } }, select: { id: true, name: true } });
  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.name]));
  return invitations.map((invitation) => {
    const state = invitation.accessTokenExpiresAt <= now && projectJourneyParticipationState(invitation) !== "REVOKED" ? "EXPIRED" as const : projectJourneyParticipationState(invitation);
    return { id: invitation.id, journeyName: invitation.relationTemplate.name, objective: invitation.relationTemplate.description, organizerName: ownerNames.get(invitation.ownerId) ?? null, participationContext: getGovernedInvitationRoleLabel(invitation.role, invitation.metadata), state, href: `/gouvernance/invitations/${encodeURIComponent(invitation.id)}` };
  });
}

export function receivedJourneyInvitationLabel(state: string) {
  return ({ PENDING: "Invitation à laquelle répondre", ACCEPTED: "Participation acceptée", DECLINED: "Invitation refusée", REVOKED: "Invitation révoquée", EXPIRED: "Invitation expirée", LEGACY_UNKNOWN: "Invitation historique" } as Record<string, string>)[state] ?? "Invitation indisponible";
}
