import Link from "next/link";
import type { WorkspacePilotage } from "@/lib/workspace-pilotage-repository";
import { businessLabel } from "@/lib/spatial-navigation";

const date = (value: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(value);
const statusLabels: Record<string, string> = { REQUESTED: "Demandée", PREPARED_NOT_STARTED: "Préparée", COMPLETED: "Terminée", CANCELLED: "Annulée" };
const linkClass = "mt-3 inline-block rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function WorkspacePilotageView({ data, counts }: { data: WorkspacePilotage; counts: { journeys: number; links: number; cases: number } }) {
  return <div className="mt-6 min-w-0 space-y-6">
    <section aria-labelledby="workspace-volumes"><h2 id="workspace-volumes" className="text-xl font-bold">Objets de cet espace</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Parcours", counts.journeys], ["Liens", counts.links], ["Dossiers", counts.cases]].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-4"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-bold">{count}</dd></div>)}</dl>
    </section>
    <section id="attention" aria-labelledby="workspace-attention"><h2 id="workspace-attention" className="text-xl font-bold">À examiner</h2>
      {data.attention.length ? <ul className="mt-2 space-y-1 text-sm text-slate-600">{data.attention.map(item => <li key={item.type}>{item.label}</li>)}</ul> : null}
      {data.signals.length ? <ul className="mt-3 grid gap-3 lg:grid-cols-2">{data.signals.map(signal => <li key={signal.id} className="min-w-0 rounded-xl border bg-white p-4">
        <h3 className="break-words font-bold">{signal.title}</h3><p className="mt-1 break-words">{businessLabel(signal.subject, "Élément à examiner")}</p>
        <p className="mt-2 break-words text-sm text-slate-600">{signal.id.startsWith("GLINK:") ? `Lien : ${businessLabel(signal.subject, "Lien")}` : `Parcours : ${businessLabel(signal.journey, "Parcours")}`}</p>
        <p className="mt-2 break-words text-sm text-slate-600">{signal.reason}</p>
        <Link href={signal.href} className={linkClass} aria-label={`Ouvrir : ${businessLabel(signal.subject, "élément à examiner")}`}>{signal.actionLabel}</Link>
      </li>)}</ul> : <p className="mt-3 rounded-xl border bg-white p-4 text-slate-600">Aucun point ne nécessite votre attention dans ce Workspace.</p>}
    </section>
    <Communications title="Réunions à venir" empty="Aucune réunion à venir." items={data.upcoming} upcoming />
    <Communications title="Communications récentes" empty="Aucune communication récente." items={data.recent} />
  </div>;
}

function Communications({ title, empty, items, upcoming = false }: { title: string; empty: string; items: WorkspacePilotage["recent"]; upcoming?: boolean }) {
  return <section aria-label={title}><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600">{upcoming ? "Les 10 prochaines réunions au maximum." : "Les 10 dernières communications mises à jour au cours des 14 derniers jours."} Rattachement enregistré dans cet espace.</p>
    {items.length ? <ul className="mt-3 grid gap-3 lg:grid-cols-2">{items.map(item => <li key={item.id} className="min-w-0 rounded-xl border bg-white p-4">
      <h3 className="break-words font-bold">{businessLabel(item.title, "Communication")}</h3><p className="mt-2 break-words text-sm text-slate-600">{businessLabel(item.context, "Communication de cet espace")}</p>
      <p className="mt-2 text-sm">{statusLabels[item.status] ?? item.status}</p>
      <p className="mt-1 text-sm"><time dateTime={(upcoming ? item.scheduledAt! : item.updatedAt).toISOString()}>{date(upcoming ? item.scheduledAt! : item.updatedAt)}</time></p>
      {item.href ? <Link href={item.href} className={linkClass} aria-label={`Ouvrir le contexte : ${businessLabel(item.title, "communication")}`}>Ouvrir le contexte</Link> : <p className="mt-3 text-sm text-slate-500">Aucun contexte accessible à ouvrir.</p>}
    </li>)}</ul> : <p className="mt-3 rounded-xl border bg-white p-4 text-slate-600">{empty}</p>}
  </section>;
}
