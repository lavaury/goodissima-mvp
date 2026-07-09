import Link from "next/link";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createWorkspaceAction } from "@/lib/governance-workspace-actions";
import { workspaceCategoryLabels, workspaceKindLabels } from "@/lib/governance-workspace-repository";

export const dynamic = "force-dynamic";

const categoryOptions = [
  "PROFESSIONAL",
  "PRIVATE",
  "FAMILY",
  "ASSOCIATION",
  "PROJECT",
  "CLIENT",
  "OTHER",
] as const;

const kindOptions = ["GOVERNANCE", "RELATION", "MIXED"] as const;

export default async function NewGovernanceWorkspacePage() {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="governance" organizationName={organizationName} />

      <div className="mt-6">
        <Link href="/gouvernance" className="text-sm font-semibold text-slate-600 underline underline-offset-4">
          Retour a la gouvernance
        </Link>
      </div>

      <section className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Workspace produit V1</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Creer un Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
          Creez un espace persistant pour organiser vos parcours gouvernes et futurs objets Goodissima.
        </p>
      </section>

      <form action={createWorkspaceAction} className="mt-6 space-y-5 rounded-lg border bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-800">
          Nom du Workspace
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Ex. Pole contrats, Suivi familial, Projet immobilier"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Description optionnelle
          <textarea
            name="description"
            maxLength={500}
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Contexte utile pour reconnaitre cet espace"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">
            Rubrique produit
            <select
              name="category"
              defaultValue="OTHER"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {workspaceCategoryLabels[category]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            Type d'usage
            <select
              name="kind"
              defaultValue="GOVERNANCE"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
            >
              {kindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {workspaceKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          V1 : le Workspace est persistant. Les membres, permissions avancees, communications et medias seront ajoutes
          dans des sprints dedies.
        </p>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Creer le Workspace
          </button>
          <Link href="/gouvernance" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
