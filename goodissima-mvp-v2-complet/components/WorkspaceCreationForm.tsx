import Link from "next/link";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import { businessLabel, workspaceCreationBreadcrumb } from "@/lib/spatial-navigation";
import { createWorkspaceAction } from "@/lib/governance-workspace-actions";
import { workspaceCategoryLabels, workspaceKindLabels } from "@/lib/governance-workspace-repository";

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

export function WorkspaceCreationForm({ portfolio = null }: { portfolio?: { id: string; name: string } | null }) {
  const cancelHref = portfolio ? `/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}` : "/gouvernance";
  return (
    <main className="mx-auto min-w-0 max-w-4xl px-4 py-8 sm:px-6 lg:px-8">


      <PageNavigationContext pathname="/gouvernance/workspaces/nouveau" items={workspaceCreationBreadcrumb(portfolio)} />
      <div className="mt-6">
        <Link href={cancelHref} className="text-sm font-semibold text-slate-600 underline underline-offset-4">
          {portfolio ? "Retour au Portfolio" : "Retour a la gouvernance"}
        </Link>
      </div>

      <section className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Workspace produit V1</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Creer un Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
          Creez un espace persistant pour organiser vos parcours gouvernes et futurs objets Goodissima.
        </p>
      </section>

      {portfolio ? <section aria-label="Portfolio" className="mt-4 rounded-xl border bg-white p-4"><h2 className="text-sm font-semibold text-slate-600">Portfolio</h2><p className="mt-1 break-words font-bold">{businessLabel(portfolio.name, "Portfolio", [portfolio.id])}</p></section> : null}
      <form action={createWorkspaceAction} className="mt-6 space-y-5 rounded-lg border bg-white p-6 shadow-sm">
        {portfolio ? <input type="hidden" name="portfolioId" value={portfolio.id} /> : null}
        <label className="block text-sm font-semibold text-slate-800">
          Nom du Workspace
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            className="mt-2 min-h-11 w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
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
              className="mt-2 min-h-11 w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
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
              className="mt-2 min-h-11 w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
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
          <button type="submit" className="min-h-11 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Creer le Workspace
          </button>
          <Link href={cancelHref} className="inline-flex min-h-11 items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border px-4 py-2 text-sm font-semibold text-slate-700">
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
