export const dynamic = "force-dynamic";

import Link from "next/link";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { TemplateAIDemoFlow } from "@/components/TemplateAIDemoFlow";
import { notFound } from "next/navigation";
import { isDemoSurfaceEnabled } from "@/lib/debug";
import { getCurrentPrismaUser } from "@/lib/auth";

export default async function TemplateAIDemoPage() {
  if (!isDemoSurfaceEnabled()) notFound();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><DashboardBackLink /><Link href="/parcours" className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600">Retour aux parcours</Link></div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Démo · Expérimental · IA-3A-TEMP-05</p>
          <h1 className="mt-2 text-3xl font-bold">Démo guidée des parcours assistés par IA</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Du besoin en langage naturel à deux versions brouillon contrôlées humainement, avec Quality Guard, Critic, Optimizer, audit et provenance.</p>
        </div>
        <ActiveOrganizationBadge organizationName={organizationName} />
      </div>
      <TemplateAIDemoFlow />
    </main>
  );
}
