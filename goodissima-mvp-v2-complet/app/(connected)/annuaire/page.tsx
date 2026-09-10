export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { DirectoryExperience } from "@/components/directory/DirectoryExperience";
import { getCurrentPrismaUser } from "@/lib/auth";
import { DirectoryAccessService } from "@/lib/directory/directory-access-service";
import { createPrismaDirectoryRepository } from "@/lib/directory/directory-repository";
import { prisma } from "@/lib/prisma";

export default async function DirectoryPage() {
  noStore();
  const currentUser = await getCurrentPrismaUser();
  const profiles = await new DirectoryAccessService(createPrismaDirectoryRepository(prisma)).listMyProfiles(currentUser.id);
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <header className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Trouver · Être trouvé</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Annuaire Goodissima</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">Trouvez des personnes et des organisations, ou choisissez les informations qui vous rendent visible dans l’Annuaire Global.</p>
    </header>
    <DirectoryExperience initialProfiles={profiles} />
  </main>;
}
