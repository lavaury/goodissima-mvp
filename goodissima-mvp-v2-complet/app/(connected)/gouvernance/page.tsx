import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getSpacesTree } from "@/lib/spaces-repository";
import { SpacesTreeView } from "@/components/SpacesTreeView";
import { SpacesCreateActions } from "@/components/SpacesCreateActions";
import { SpacesExistingAttachments } from "@/components/SpacesExistingAttachments";

export default async function GovernanceWorkspacePage() {
  noStore();
  const owner = await getCurrentPrismaUser();
  const data = await getSpacesTree(owner.id);
  return <main className="mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6">
    <header data-boussole-id="governance-overview">
      <h1 className="text-3xl font-bold">Mes espaces</h1>
      <p className="mt-2 text-slate-600">Retrouvez vos Workspaces et organisez-les dans vos Portfolios.</p>
      <SpacesCreateActions />
    </header>
    <SpacesTreeView data={data} />
    <p data-boussole-id="governance-human-control-notice" className="mt-6 text-sm text-slate-600">Créer ou ouvrir un espace ne contacte personne. Les décisions, invitations et revues restent humaines.</p>
    <SpacesExistingAttachments ownerId={owner.id} />
  </main>;
}
