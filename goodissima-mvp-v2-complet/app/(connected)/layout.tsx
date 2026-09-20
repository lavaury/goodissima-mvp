import type { ReactNode } from "react";
import { ConnectedShell } from "@/components/ConnectedShell";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeInvitationEmail } from "@/lib/access-invitations";
import { canAccessAIValue } from "@/lib/ai-value-access";
import { unstable_noStore as noStore } from "next/cache";

export default async function ConnectedLayout({ children }: { children: ReactNode }) {
  // Read the existing session and persisted role; no upsert/provisioning in the shell.
  // Pages, actions and repositories retain their own authorization checks.
  noStore();
  const user = await requireCurrentUser();
  const owner = await prisma.user.findUnique({
    where: { email: normalizeInvitationEmail(user.email!) },
    select: { role: true },
  });
  const name = user.user_metadata?.name;
  const organizationName = typeof name === "string" && name.trim() && name !== user.email
    ? name
    : "Organisation Goodissima";

  return <ConnectedShell organizationName={organizationName} aiValueAllowed={canAccessAIValue(owner?.role)}>{children}</ConnectedShell>;
}
