import Link from "next/link";
import { attachGLinkToWorkspaceAction, attachGovernedJourneyToWorkspaceAction, attachRelationCaseToWorkspaceAction } from "@/lib/governance-workspace-actions";
import { getGovernanceWorkspaceOptions, getUnassignedGLinkSummaries, getUnassignedGovernedJourneySummaries, getUnassignedRelationCaseSummaries } from "@/lib/governance-workspace-repository";
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value); }
/** Existing attachment forms retained verbatim; not the future unclassified-object experience. */
export async function SpacesExistingAttachments({ ownerId }: { ownerId: string }) {
 const [workspaceOptions, unassignedJourneys, unassignedRelationCases, unassignedGLinks] = await Promise.all([getGovernanceWorkspaceOptions(ownerId), getUnassignedGovernedJourneySummaries(ownerId), getUnassignedRelationCaseSummaries(ownerId), getUnassignedGLinkSummaries(ownerId)]);
 return <div className="mt-10 border-t pt-4">      {unassignedJourneys.length > 0 ? (
        <section data-boussole-id="governed-journeys-without-workspace" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">Rattachement manuel</p>
              <h2 className="mt-1 text-2xl font-bold text-amber-950">Parcours gouvernes sans Workspace</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-900">
                Ces parcours existent deja et peuvent etre rattaches a un Workspace produit actif. Aucun Workspace,
                invitation, acces ou workflow n'est cree automatiquement.
              </p>
            </div>
            <Link href="/gouvernance/workspaces/nouveau" data-boussole-id="create-workspace-from-unassigned-journeys" className="w-fit rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950">
              Creer un Workspace
            </Link>
          </div>

          {workspaceOptions.length === 0 ? (
            <p data-boussole-id="no-workspace-available-for-attachment" className="mt-5 rounded-lg bg-white px-4 py-3 text-sm text-amber-900">
              Aucun Workspace actif disponible pour le rattachement.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {unassignedJourneys.map((journey, index) => (
                <article key={journey.formTemplateId} data-boussole-id={index === 0 ? "first-unassigned-governed-journey" : undefined} className="rounded-lg border border-amber-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 data-boussole-id={index === 0 ? "unassigned-journey-title" : undefined} className="font-bold text-slate-950">{journey.title}</h3>
                      <p data-boussole-id={index === 0 ? "unassigned-journey-created-at" : undefined} className="mt-1 text-xs font-semibold text-slate-500">Cree le {formatDate(journey.createdAt)}</p>
                      <Link href={journey.href} data-boussole-id={index === 0 ? "open-unassigned-journey-cockpit" : undefined} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                        Ouvrir le cockpit
                      </Link>
                    </div>
                    <form action={attachGovernedJourneyToWorkspaceAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="hidden" name="formTemplateId" value={journey.formTemplateId} />
                      <select
                        name="workspaceId"
                        data-boussole-id={index === 0 ? "select-workspace-for-journey" : undefined}
                        required
                        className="min-w-0 w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
                      >
                        <option value="">Choisir un Workspace</option>
                        {workspaceOptions.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name} - {workspace.categoryLabel} - {workspace.kindLabel}
                          </option>
                        ))}
                      </select>
                      <button type="submit" data-boussole-id={index === 0 ? "attach-journey-to-workspace" : undefined} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        Rattacher au Workspace
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : <p data-boussole-id="no-unassigned-governed-journeys" className="mt-6 rounded-lg border border-dashed bg-white p-5 text-sm text-slate-600">Tous les parcours gouvernés visibles sont déjà organisés dans un Workspace.</p>}

      <section data-boussole-id="relational-cases-workspace-attachment" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Dossiers relationnels</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Rattachement aux Workspaces</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-700">
              Le rattachement au Workspace organise les dossiers et liens existants. Il ne modifie pas les acces candidats,
              n'envoie aucune notification et ne cree aucun nouveau lien.
            </p>
          </div>
          <Link href="/gouvernance/workspaces/nouveau" className="w-fit rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
            Creer un Workspace
          </Link>
        </div>

        {unassignedRelationCases.length === 0 ? (
          <p data-boussole-id="no-unassigned-relational-cases" className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Aucun dossier relationnel sans Workspace.
          </p>
        ) : (
          <div data-boussole-id="relational-cases-without-workspace" className="mt-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Dossiers sans Workspace</h3>
            {unassignedRelationCases.map((relationCase, index) => (
              <article key={relationCase.id} data-boussole-id={index === 0 ? "first-unassigned-relational-case" : undefined} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-950">{relationCase.candidateName || relationCase.candidateEmail}</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {relationCase.gLinkTitle} - {relationCase.status} - cree le {formatDate(relationCase.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Communications relationnelles : {relationCase.communicationsCount}
                    </p>
                    <Link href={relationCase.href} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                      Ouvrir le dossier
                    </Link>
                  </div>
                  {workspaceOptions.length > 0 ? (
                    <form action={attachRelationCaseToWorkspaceAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="hidden" name="relationCaseId" value={relationCase.id} />
                      <select
                        name="workspaceId"
                        data-boussole-id={index === 0 ? "select-workspace-for-relational-case" : undefined}
                        required
                        className="min-w-0 w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
                      >
                        <option value="">Choisir un Workspace</option>
                        {workspaceOptions.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name} - {workspace.categoryLabel} - {workspace.kindLabel}
                          </option>
                        ))}
                      </select>
                      <button type="submit" data-boussole-id={index === 0 ? "attach-relational-case-to-workspace" : undefined} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        Rattacher au Workspace
                      </button>
                    </form>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Aucun Workspace actif disponible.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {unassignedGLinks.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Aucun lien relationnel sans Workspace.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Liens relationnels sans Workspace</h3>
            {unassignedGLinks.map((link) => (
              <article key={link.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-950">{link.title}</h4><p className="text-xs text-slate-500">{link.objectLabel}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      /l/{link.slug} - {link.status} - cree le {formatDate(link.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dossiers lies : {link.relationCaseCount}. Dossiers lies sans Workspace : {link.unassignedRelationCaseCount}.
                    </p>
                    <Link href={link.href} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                      Ouvrir le lien
                    </Link>
                  </div>
                  {workspaceOptions.length > 0 ? (
                    <form action={attachGLinkToWorkspaceAction} className="flex flex-col gap-2 lg:items-end">
                      <input type="hidden" name="gLinkId" value={link.id} />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          name="workspaceId"
                          required
                          className="min-w-0 w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
                        >
                          <option value="">Choisir un Workspace</option>
                          {workspaceOptions.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                              {workspace.name} - {workspace.categoryLabel} - {workspace.kindLabel}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                          Rattacher au Workspace
                        </button>
                      </div>
                      {link.unassignedRelationCaseCount > 0 ? (
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input type="checkbox" name="attachUnassignedCases" className="h-4 w-4" />
                          Rattacher aussi les dossiers de ce lien encore sans Workspace
                        </label>
                      ) : null}
                    </form>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Aucun Workspace actif disponible.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

</div>;
}
