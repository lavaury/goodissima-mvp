import { notFound } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getWorkspaceDetail } from "@/lib/workspace-detail-repository";
import { WorkspaceDetailView } from "@/components/WorkspaceDetailView";
import { getWorkspacePilotage } from "@/lib/workspace-pilotage-repository";
import { WorkspacePilotageView } from "@/components/WorkspacePilotageView";

export const dynamic = "force-dynamic";
export default async function WorkspacePage({ params, searchParams }: { params: { id: string }; searchParams?: { view?: string } }) {
  const owner = await getCurrentPrismaUser();
  const workspace = await getWorkspaceDetail(owner.id, params.id);
  if (!workspace) notFound();
  const explorer = searchParams?.view === "explorer";
  const data = explorer ? null : await getWorkspacePilotage(owner.id, workspace.id);
  return <WorkspaceDetailView workspace={workspace} explorer={explorer} pilotage={data ? <WorkspacePilotageView data={data} counts={{ journeys: workspace.relationTemplates.length, links: workspace.links.length, cases: workspace.relationCases.length }} /> : null} />;
}
