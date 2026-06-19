export const dynamic = "force-dynamic";

import Link from "next/link";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { GoodissimaExperienceJourney } from "@/components/GoodissimaExperienceJourney";
import { getCurrentPrismaUser } from "@/lib/auth";
import { housingRentalOffer, rankHousingCandidates } from "@/lib/housing-candidate-demo";
import { prisma } from "@/lib/prisma";

export default async function GoodissimaExperiencePage() {
  const owner = await getCurrentPrismaUser();
  const latestCase = await prisma.relationCase.findFirst({ where: { ownerId: owner.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return <main className="mx-auto max-w-7xl px-6 py-10"><DashboardBackLink /><p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Démo · Expérimental · expérience guidée</p><h1 className="mt-2 text-4xl font-bold">De votre besoin à une relation gouvernée</h1><p className="mt-3 max-w-3xl text-slate-600">Cette route reste disponible pour le développement. Le parcours principal commence désormais dans Opportunités.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/opportunities/new" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Créer une opportunité</Link><Link href="/opportunities" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">Voir mes opportunités</Link></div><GoodissimaExperienceJourney offer={housingRentalOffer} candidates={rankHousingCandidates()} workspaceHref={latestCase ? `/cases/${latestCase.id}` : "/relations"} /></main>;
}
