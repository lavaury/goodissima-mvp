import Link from "next/link";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createGovernancePortfolioAction } from "@/lib/governance-portfolio-actions";
import { portfolioKindLabels } from "@/lib/governance-portfolio-repository";

export const dynamic = "force-dynamic";

const portfolioKinds = [
  "JUDICIAL",
  "PROFESSIONAL",
  "ASSOCIATION",
  "FAMILY",
  "PROJECT",
  "PERSONAL",
  "OTHER",
] as const;

export default async function NewGovernancePortfolioPage() {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="governance" organizationName={organizationName} />

      <Link href="/gouvernance" className="text-sm font-semibold text-slate-600 underline underline-offset-4">
        Retour a la gouvernance
      </Link>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Portfolio produit</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Creer un Portfolio</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Un Portfolio regroupe plusieurs Workspaces. Il ne cree aucun dossier, aucun acces, aucune notification et aucune
          action automatique.
        </p>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          V1 : le Portfolio regroupe les Workspaces. La salle de pilotage, les signaux d'intervention et l'IA assistive
          seront ajoutes dans des sprints dedies.
        </p>

        <form action={createGovernancePortfolioAction} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Nom
            <input
              name="name"
              required
              minLength={2}
              maxLength={140}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
              placeholder="Portefeuille de mission"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Description optionnelle
            <textarea
              name="description"
              maxLength={800}
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
              placeholder="Perimetre, mission ou ensemble de dossiers suivis."
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Type de Portfolio
            <select
              name="kind"
              defaultValue="OTHER"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
            >
              {portfolioKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {portfolioKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Creer le Portfolio
            </button>
            <Link href="/gouvernance" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
              Annuler
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
