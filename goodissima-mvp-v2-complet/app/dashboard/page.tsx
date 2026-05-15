export const dynamic = "force-dynamic";

import Link from "next/link";
import { LinkCard } from "@/components/LinkCard";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const owner = await getCurrentPrismaUser();
  const links = await prisma.gLink.findMany({
    where: { ownerId: owner.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes liens sécurisés</h1>
          <p className="text-slate-500">Compte connecté : {owner.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/links/new" className="rounded-2xl bg-slate-900 px-5 py-3 text-white">
          Créer un lien
          </Link>
          <LogoutButton />
        </div>
      </div>
      {links.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <p className="text-slate-600">Aucun lien pour le moment.</p>
          <Link
            href="/links/new"
            className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-white"
          >
            Créer le premier lien
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {links.map((item) => (
            <LinkCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
