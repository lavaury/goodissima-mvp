export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { DirectoryTabs } from "@/components/directory/DirectoryTabs";
import { MyDirectoryOverview } from "@/components/directory/MyDirectoryOverview";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { listRepresentations } from "@/lib/directory/representation-service";

type DirectoryPageProps = { searchParams?: { tab?: string } };

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  noStore();
  const currentUser = await getCurrentPrismaUser();
  const organizationName = currentUser.name && currentUser.name !== currentUser.email
    ? currentUser.name
    : "Organisation Goodissima";
  const activeTab = searchParams?.tab === "moi" ? "moi" : "global";
  const representations = currentUser.goodissimaIdentityId
    ? await listRepresentations(currentUser.id)
    : [];
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
        <section aria-labelledby="directory-global-title" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global</p>
          <h2 id="directory-global-title" className="mt-1 text-xl font-semibold text-slate-950">Lecture globale en préparation</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Les propriétaires peuvent préparer explicitement la visibilité de leurs représentations. La liste globale et
            la recherche seront activées dans un prochain lot ; aucun profil privé, contact ou résultat fictif n’est affiché ici.
          </p>
          <div data-boussole-id="directory-identity" className="mt-5 rounded-xl border bg-slate-50 p-4">
            <p className="font-semibold text-slate-950">Votre identité Goodissima</p>
            <p className="mt-2 text-sm text-slate-600">
              {currentUser.goodissimaIdentityId
                ? "Une identité est liée à votre compte. Chaque représentation reste privée jusqu’à une publication explicite."
                : "Aucune identité Goodissima n’est liée à votre compte."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/identity" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Ouvrir l’espace identité
              </Link>
              <Link data-boussole-id="open-governance" href="/gouvernance" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Ouvrir la gouvernance
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
