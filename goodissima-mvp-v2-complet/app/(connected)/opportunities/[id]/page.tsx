export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectOpportunity } from "@/lib/opportunities/opportunity-projection";
import type { OpportunityDay } from "@/lib/opportunities/contracts";

const dayLabels: Record<OpportunityDay, string> = {
  MONDAY: "Lundi", TUESDAY: "Mardi", WEDNESDAY: "Mercredi", THURSDAY: "Jeudi",
  FRIDAY: "Vendredi", SATURDAY: "Samedi", SUNDAY: "Dimanche",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-base font-semibold text-slate-900">{children}</dd></div>;
}

export default async function AutonomousOpportunityPage({ params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const item = await prisma.gLink.findFirst({
    where: { id: params.id, ownerId: owner.id },
    select: { id: true, title: true, description: true, status: true, rules: true, templateId: true },
  });
  if (!item) notFound();

  const projection = projectOpportunity(item);
  if (!projection) notFound();
  if (projection.legacy || projection.hasGovernedJourney) redirect(`/links/${encodeURIComponent(item.id)}`);
  if (!projection.structuredCriteria || !projection.type) notFound();

  const criteria = projection.structuredCriteria;
  const availability = criteria.availability;
  const dateWindow = criteria.dateWindow;
  const priceRange = criteria.priceRange;

  return <main className="mx-auto max-w-3xl px-6 py-10">
    <nav aria-label="Fil d’Ariane" className="text-sm text-slate-600">
      <Link href="/">Accueil</Link> <span aria-hidden="true">›</span> <Link href="/opportunities">Opportunités</Link> <span aria-hidden="true">›</span> <span aria-current="page">{item.title}</span>
    </nav>
    <Link href="/opportunities" className="mt-6 inline-flex min-h-11 items-center font-semibold text-[#247f88]">← Retour</Link>

    <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Opportunité</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{item.title}</h1></div>
      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">{item.status === "DRAFT" ? "Brouillon" : item.status}</span>
    </header>

    {item.status === "DRAFT" ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">Brouillon — cette opportunité n’est pas encore publiée.</p> : null}

    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
      <Field label={projection.type === "NEED" ? "Je recherche" : "Je propose"}>{criteria.subject}</Field>
      {criteria.category ? <Field label="Catégorie">{criteria.category}</Field> : null}
      {criteria.locations?.length ? <Field label="Lieu">{criteria.locations.join(", ")}</Field> : null}
      {availability?.days?.length ? <Field label="Jours">{availability.days.map(day => dayLabels[day]).join(", ")}</Field> : null}
      {availability?.timeFrom || availability?.timeTo ? <Field label="Horaires">{availability.timeFrom ?? "…"} → {availability.timeTo ?? "…"}</Field> : null}
      {dateWindow?.from || dateWindow?.to ? <Field label="Dates">{dateWindow.from ?? "…"} → {dateWindow.to ?? "…"}</Field> : null}
      {priceRange ? <Field label="Budget">{priceRange.min ?? "…"} → {priceRange.max ?? "…"} {priceRange.currency}{priceRange.unit ? ` / ${priceRange.unit}` : ""}</Field> : null}
      {criteria.terms?.length ? <Field label="Critères complémentaires">{criteria.terms.join(", ")}</Field> : null}
    </dl>

    {item.description ? <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold text-slate-950">Description</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{item.description}</p></section> : null}
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/gouvernance" className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700">Voir dans Mes espaces</Link></div>
  </main>;
}
