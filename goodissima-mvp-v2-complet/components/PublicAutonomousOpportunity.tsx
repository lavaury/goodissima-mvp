import type { OpportunityProjection } from "@/lib/opportunities/opportunity-projection";
import type { OpportunityDay } from "@/lib/opportunities/contracts";
import { PublicOpportunitySecureExchange } from "@/components/PublicOpportunitySecureExchange";

const days: Record<OpportunityDay, string> = { MONDAY: "Lundi", TUESDAY: "Mardi", WEDNESDAY: "Mercredi", THURSDAY: "Jeudi", FRIDAY: "Vendredi", SATURDAY: "Samedi", SUNDAY: "Dimanche" };

export function PublicAutonomousOpportunity({ gLinkId, title, description, projection }: { gLinkId: string; title: string; description: string | null; projection: OpportunityProjection }) {
  const criteria = projection.structuredCriteria!;
  return <article className="rounded-3xl border bg-white p-6 shadow-sm sm:p-9">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Opportunité</p>
    <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{title}</h1>
    <dl className="mt-7 grid gap-4 sm:grid-cols-2">
      <Field label={projection.type === "NEED" ? "Je recherche" : "Je propose"}>{criteria.subject}</Field>
      {criteria.category ? <Field label="Catégorie">{criteria.category}</Field> : null}
      {criteria.locations?.length ? <Field label="Lieu">{criteria.locations.join(", ")}</Field> : null}
      {criteria.availability?.days?.length ? <Field label="Jours">{criteria.availability.days.map(day => days[day]).join(", ")}</Field> : null}
      {criteria.availability?.timeFrom || criteria.availability?.timeTo ? <Field label="Horaires">{criteria.availability.timeFrom ?? "…"} → {criteria.availability.timeTo ?? "…"}</Field> : null}
      {criteria.dateWindow?.from || criteria.dateWindow?.to ? <Field label="Dates">{criteria.dateWindow.from ?? "…"} → {criteria.dateWindow.to ?? "…"}</Field> : null}
      {criteria.priceRange ? <Field label="Prix / rémunération">{criteria.priceRange.min ?? "…"} → {criteria.priceRange.max ?? "…"} {criteria.priceRange.currency}</Field> : null}
      {criteria.terms?.length ? <Field label="Critères complémentaires">{criteria.terms.join(", ")}</Field> : null}
    </dl>
    {description ? <section className="mt-6 border-t pt-6"><h2 className="font-bold">Description</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{description}</p></section> : null}
    <PublicOpportunitySecureExchange gLinkId={gLinkId} />
  </article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{children}</dd></div>;
}
