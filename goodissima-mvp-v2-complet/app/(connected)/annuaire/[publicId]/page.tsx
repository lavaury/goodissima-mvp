export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import { DirectoryProfileCard } from "@/components/directory/DirectoryProfileCard";
import { DirectoryAccessService } from "@/lib/directory/directory-access-service";
import { createPrismaDirectoryRepository } from "@/lib/directory/directory-repository";
import { prisma } from "@/lib/prisma";

export default async function PublicDirectoryProfilePage({ params }: { params: { publicId: string } }) {
  const profile = await new DirectoryAccessService(createPrismaDirectoryRepository(prisma)).getPublishedProfile(params.publicId);
  if (!profile) notFound();
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
    <PageNavigationContext pathname={`/annuaire/${encodeURIComponent(profile.publicId)}`} items={[{ label: "Accueil", href: "/dashboard" }, { label: "Annuaire", href: "/annuaire" }, { label: profile.publicName }]} />
    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Profil public de l’Annuaire</p>
    <h1 className="mt-2 text-3xl font-bold text-slate-950">{profile.publicName}</h1>
    <div data-boussole-id="directory-public-profile" className="mt-6"><DirectoryProfileCard profile={profile} detailed /></div>
  </main>;
}
