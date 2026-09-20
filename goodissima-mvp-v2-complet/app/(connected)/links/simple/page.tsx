import { getCurrentPrismaUser } from "@/lib/auth";
import { SimpleLinkBuilder } from "./simple-link-builder";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceCreationContext } from "@/lib/workspace-creation-context";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import { objectBreadcrumb, businessLabel } from "@/lib/spatial-navigation";

export const dynamic = "force-dynamic";

export default async function SimpleLinkPage({ searchParams }: { searchParams?: { workspaceId?: string } }) {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const workspace = searchParams?.workspaceId !== undefined ? await getWorkspaceCreationContext(owner.id, searchParams.workspaceId) : null;
  if (searchParams?.workspaceId !== undefined && !workspace) notFound();

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">

      {workspace ? <><PageNavigationContext pathname="/links/simple" items={objectBreadcrumb({ name: "Créer un lien simple", fallback: "Créer un lien simple", objectId: "", ownerId: owner.id, workspace })} /><p className="mb-4 break-words text-sm">Workspace : <Link href={`/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`} className="font-semibold underline">{businessLabel(workspace.name, "Workspace", [workspace.id])}</Link></p></> : null}
      <SimpleLinkBuilder key={workspace?.id ?? "generic"} workspaceId={workspace?.id} />
    </main>
  );
}
