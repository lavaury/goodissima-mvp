"use server";

import { getCurrentPrismaUser } from "@/lib/auth";
import {
  getRealGovernanceWorkspaceSummaries,
  type RealGovernanceWorkspaceSummary,
} from "@/lib/governance-workspace-repository";

export async function listCurrentUserGovernanceWorkspacesAction(): Promise<RealGovernanceWorkspaceSummary[]> {
  const owner = await getCurrentPrismaUser();
  return getRealGovernanceWorkspaceSummaries(owner.id);
}
