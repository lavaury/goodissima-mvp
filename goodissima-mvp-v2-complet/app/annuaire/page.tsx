export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { DirectoryTabs } from "@/components/directory/DirectoryTabs";
import { MyDirectoryOverview } from "@/components/directory/MyDirectoryOverview";
import { GlobalDirectory } from "@/components/directory/GlobalDirectory";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { listPublicRepresentations, listRepresentations } from "@/lib/directory/representation-service";
import { parsePublicDirectoryQuery } from "@/lib/directory/contracts";

type DirectoryPageProps = { searchParams?: Record<string, string | string[] | undefined> };

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  noStore();
  const currentUser = await getCurrentPrismaUser();
  const organizationName = currentUser.name && currentUser.name !== currentUser.email
    ? currentUser.name
    : "Organisation Goodissima";
  const activeTab = searchParams?.tab === "moi" ? "moi" : "global";
  const publicQuery = parsePublicDirectoryQuery(searchParams ?? {});
  const representations = activeTab === "moi" && currentUser.goodissimaIdentityId
    ? await listRepresentations(currentUser.id)
    : [];
  const publicResult = activeTab === "global"
    ? await listPublicRepresentations(searchParams ?? {})
    : { items: [], limitReached: false };
  const serializedRepresentations = representations.map((representation) => ({
    ...representation,
    createdAt: representation.createdAt.toISOString(),
    updatedAt: representation.updatedAt.toISOString(),
    archivedAt: representation.archivedAt?.toISOString() ?? null,
    publishedAt: representation.publishedAt?.toISOString() ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Espace privé</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Annuaire Goodissima</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Gérez vos représentations et choisissez explicitement celles qui pourront apparaître dans l’Annuaire global.
          </p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation active="directory" organizationName={organizationName} />
      <DirectoryTabs activeTab={activeTab} />

      {activeTab === "moi" ? (
        <MyDirectoryOverview
          hasIdentity={Boolean(currentUser.goodissimaIdentityId)}
          initialRepresentations={serializedRepresentations}
        />
      ) : (
        <div className="space-y-6" data-boussole-state={publicResult.items.length ? "POPULATED" : "EMPTY"}>
          <GlobalDirectory items={publicResult.items} query={publicQuery} limitReached={publicResult.limitReached} />
          <section data-boussole-id="directory-identity" aria-labelledby="global-identity-title" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h2 id="global-identity-title" className="font-semibold text-slate-950">Votre identité Goodissima</h2>
            <p className="mt-2 text-sm text-slate-600">
              {currentUser.goodissimaIdentityId
                ? "Une identité est liée à votre compte. Chaque représentation reste privée jusqu’à une publication explicite."
                : "Aucune identité Goodissima n’est liée à votre compte."}
            </p>
            <Link href="/identity" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ouvrir l’espace identité</Link>
          </section>
        </div>
      )}
    </main>
  );
}
