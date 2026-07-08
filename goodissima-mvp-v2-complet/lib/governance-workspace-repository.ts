export type RealGovernanceWorkspaceSummary = {
  workspaceId: string;
  slug: string;
  name: string;
  href: string;
  journeyCount: number;
  relationCount: number;
  totalObjects: number;
  state: "Etat non evalue";
  observation: string;
};

/**
 * Reads Workspaces that are really attached to the current owner's data
 * from models exposing a persisted workspaceId.
 *
 * In the current Prisma schema, GLink, RelationTemplate and RelationCase do not
 * expose workspaceId, so no real Workspace can be sourced from governance data.
 */
export async function getRealGovernanceWorkspaceSummaries(_ownerId: string): Promise<RealGovernanceWorkspaceSummary[]> {
  return [];
}
