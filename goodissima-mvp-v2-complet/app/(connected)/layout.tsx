import type { ReactNode } from "react";
import { ConnectedShell } from "@/components/ConnectedShell";
import { requireCurrentUser } from "@/lib/auth";

export default async function ConnectedLayout({ children }: { children: ReactNode }) {
  // Read the existing session only: no Prisma upsert/provisioning in the shell.
  // Pages, actions and repositories retain their own authorization checks.
  const user = await requireCurrentUser();
  const name = user.user_metadata?.name;
  const organizationName = typeof name === "string" && name.trim() && name !== user.email
    ? name
    : "Organisation Goodissima";

  return <ConnectedShell organizationName={organizationName}>{children}</ConnectedShell>;
}
