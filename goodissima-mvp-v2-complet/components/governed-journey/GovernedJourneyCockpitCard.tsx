import type { GovernedJourneyCockpitView } from "@/lib/governed-journey/cockpit/read-service";

function formatCreationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function contextCountLabel(count: number) {
  return `${count} dossier${count > 1 ? "s" : ""} rattaché${count > 1 ? "s" : ""}`;
}

export function GovernedJourneyCockpitCard({ view }: { view: GovernedJourneyCockpitView }) {
  return (
    <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Gouvernance du parcours</h2>
      {!view.extension ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Ce parcours historique ne possède pas encore d’extension de journal gouverné.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-emerald-800">Extension gouvernée active</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Cette extension prépare le journal gouverné et la mémoire future du parcours, sans modifier son pilotage.
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créée le</p>
              <p className="mt-1 font-bold text-slate-950">{formatCreationDate(view.extension.createdAt)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version source de l’extension</p>
              <p className="mt-1 font-bold text-slate-950">{view.extension.createdFromVersionLabel ?? "Version source non disponible"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contextes dossier</p>
              <p className="mt-1 font-bold text-slate-950">{contextCountLabel(view.extension.contextCount)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Journal</p>
              <p className="mt-1 font-bold text-slate-950">
                {view.extension.hasLegacyEventLog ? "Journal historique disponible" : "Journal global non encore activé"}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
