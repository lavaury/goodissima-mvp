export const dynamic = "force-dynamic";

import Link from "next/link";
import { LinkCard } from "@/components/LinkCard";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const owner = await getCurrentPrismaUser();
  const [links, cases] = await Promise.all([
    prisma.gLink.findMany({
      where: { ownerId: owner.id },
      include: {
        cases: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.relationCase.findMany({
      where: { ownerId: owner.id },
      select: {
        gLinkId: true,
        priority: true,
        status: true,
      },
    }),
  ]);
  const activeLinkIds = new Set(
    cases.filter((item) => item.status !== "CLOSED").map((item) => item.gLinkId),
  );
  const stats = [
    { label: "Liens créés", value: links.length },
    { label: "Dossiers actifs", value: activeLinkIds.size },
    { label: "En attente de contact", value: links.length - activeLinkIds.size },
    { label: "Prioritaires", value: cases.filter((item) => item.priority === "HIGH").length },
    { label: "Urgents", value: cases.filter((item) => item.priority === "URGENT").length },
    { label: "Clôturés", value: cases.filter((item) => item.status === "CLOSED").length },
  ];

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
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
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
