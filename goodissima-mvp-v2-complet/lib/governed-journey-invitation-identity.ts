import { normalizeInvitationEmail } from "@/lib/access-invitations";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function invitationIdentityMatches(inviteeUserId: string | null) {
  if (!inviteeUserId) return false;
  const authUser = await getCurrentUser();
  if (!authUser?.email) return false;
  const user = await prisma.user.findUnique({ where: { email: normalizeInvitationEmail(authUser.email) }, select: { id: true } });
  return user?.id === inviteeUserId;
}
