import Link from "next/link";
import type { GovernedJourneyDetail, GovernedJourneyEvent, GovernedJourneySummary } from "@/lib/governed-journey/read/types";

const statusLabels = { DRAFT: "Brouillon", ACTIVE: "Actif", SUSPENDED: "Suspendu", CLOSED: "Clôturé", CANCELLED: "Annulé" } as const;
const eventLabels = { CREATED: "Création", ACTIVATED: "Activation", SUSPENDED: "Suspension", RESUMED: "Reprise", CLOSED: "Clôture", CANCELLED: "Annulation" } as const;
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

export function governedJourneyStatusLabel(status: GovernedJourneySummary["status"]) { return statusLabels[status]; }
export function governedJourneyEventLabel(type: GovernedJourneyEvent["type"]) { return eventLabels[type]; }
function DateValue({ value }: { value: string }) { return <time dateTime={value}>{dateFormatter.format(new Date(value))}</time>; }

export function GovernedJourneyCards({ caseId, journeys }: { caseId: string; journeys: GovernedJourneySummary[] }) {
  if (journeys.length === 0) return <p className="mt-3 rounded-xl bg-[#f6f0e8] px-3 py-3 text-sm text-[#766f68]">Aucun parcours gouverné n’est rattaché à ce dossier.</p>;
  return <ul className="mt-3 grid gap-3">{journeys.map((journey) => <li key={journey.id}>
    <Link href={`/cases/${encodeURIComponent(caseId)}/journeys/${encodeURIComponent(journey.id)}`} className="block rounded-xl border border-[#e7e0d6] bg-[#fffcf8] p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500">
      <span className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[#2f3437]">{journey.title}</strong><span className="rounded-full bg-[#e8f8f9] px-2.5 py-1 text-xs font-semibold text-[#247f88]">{governedJourneyStatusLabel(journey.status)}</span></span>
      <span className="mt-2 block text-xs text-[#766f68]">Mis à jour le <DateValue value={journey.updatedAt} /></span>
    </Link>
  </li>)}</ul>;
}

export function GovernedJourneyDetailView({ journey }: { journey: GovernedJourneyDetail }) {
  const dates = [
    ["Créé", journey.createdAt], ["Mis à jour", journey.updatedAt], ["Démarré", journey.startedAt],
    ["Suspendu", journey.suspendedAt], ["Clôturé", journey.closedAt], ["Annulé", journey.cancelledAt],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return <>
    <div className="mt-5 rounded-2xl border border-[#d6e7e8] bg-white p-5">
      <span className="rounded-full bg-[#e8f8f9] px-3 py-1 text-xs font-semibold text-[#247f88]">{governedJourneyStatusLabel(journey.status)}</span>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">{dates.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-[#766f68]">{label}</dt><dd className="mt-1 text-sm"><DateValue value={value} /></dd></div>)}</dl>
    </div>
    <section className="mt-5 rounded-2xl border border-[#d6e7e8] bg-white p-5"><h2 className="text-lg font-bold">Historique</h2>
      {journey.events.length === 0 ? <p className="mt-3 text-sm text-[#766f68]">Aucun événement enregistré.</p> : <ol className="mt-4 space-y-3">{journey.events.map((event) => <li key={event.sequence} className="border-l-2 border-[#d6e7e8] pl-4"><p className="font-semibold">{event.sequence}. {governedJourneyEventLabel(event.type)}</p><p className="text-xs text-[#766f68]"><DateValue value={event.occurredAt} />{event.fromStatus ? ` · ${governedJourneyStatusLabel(event.fromStatus)} → ${governedJourneyStatusLabel(event.toStatus)}` : ` · Aucun statut antérieur → ${governedJourneyStatusLabel(event.toStatus)}`}</p></li>)}</ol>}
    </section>
  </>;
}
