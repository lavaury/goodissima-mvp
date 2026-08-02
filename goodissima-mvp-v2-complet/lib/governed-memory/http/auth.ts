import { normalizeInvitationEmail } from "@/lib/access-invitations";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class GovernedMemoryHttpAuthError extends Error {
  constructor() { super("Unauthenticated governed-memory request."); this.name = "GovernedMemoryHttpAuthError"; }
}

export async function authenticateGovernedMemoryRequester() {
  const sessionUser = await getCurrentUser().catch(() => null);
  if (!sessionUser?.email || !sessionUser.email_confirmed_at) throw new GovernedMemoryHttpAuthError();
  const appUser = await prisma.user.findUnique({ where: { email: normalizeInvitationEmail(sessionUser.email) }, select: { id: true } });
  if (!appUser) throw new GovernedMemoryHttpAuthError();
  return { requesterUserId: appUser.id };
}
