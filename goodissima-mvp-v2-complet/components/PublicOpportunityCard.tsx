import {
  OPPORTUNITY_CATEGORY_VISUALS,
  OPPORTUNITY_CATEGORY_LABELS,
  OPPORTUNITY_EMPTY_STATES,
  enrichOpportunityPresentation,
} from "@/lib/opportunity-preview";
import { productObjectDefinitions } from "@/lib/product-object-clarity";

export function PublicOpportunityCard({ title, city, description, presentation }: { title: string; city: string | null; description: string | null; presentation: Record<string, unknown> }) {
  const preview = enrichOpportunityPresentation({ name: title, description, inputDescription: description, presentation });
  const visual = preview.photos[0] || OPPORTUNITY_CATEGORY_VISUALS[preview.category];
  const attachments = preview.attachments;
  const links = preview.verifiedLinks;
  return <article className="overflow-hidden rounded-3xl border border-[#d6e7e8] bg-white shadow-[0_20px_60px_rgba(38,56,70,0.12)]">
    <div className="relative min-h-[28rem] bg-slate-900 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(90deg, rgba(20,32,40,.88), rgba(20,32,40,.18)), url("${visual.replace(/"/g, "\\\"")}")` }}>
      <div className="flex min-h-[28rem] max-w-3xl flex-col justify-end p-7 text-white sm:p-10"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">Annonce sécurisée</span><span className="rounded-full bg-cyan-300/20 px-3 py-1 text-xs font-semibold text-cyan-50 backdrop-blur">Provenance conservée</span></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{OPPORTUNITY_CATEGORY_LABELS[preview.category]}</p><h1 className="mt-2 text-4xl font-bold sm:text-5xl">{preview.title}</h1><p className="mt-3 text-xl text-white/90">{preview.subtitle}</p>{city ? <p className="mt-2 text-white/75">{city}</p> : null}<div className="mt-5 flex flex-wrap gap-2">{preview.highlights.map((item) => <span key={item} className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-800">✓ {item}</span>)}</div></div>
    </div>
    <div className="p-7 sm:p-9"><h2 className="text-xl font-bold text-slate-900">À propos de cette opportunité</h2><p className="mt-1 text-sm text-slate-500">{productObjectDefinitions.announcement}</p><p className="mt-3 max-w-4xl text-base leading-relaxed text-slate-700">{preview.summary}</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{preview.keyMetrics.map((metric) => <div key={metric.label} className="rounded-2xl bg-[#f6f0e8] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#746d66]">{metric.label}</p><p className="mt-1 text-lg font-bold text-[#2f3437]">{metric.value}</p></div>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><PublicResource title="Documents partagés" items={attachments} empty={OPPORTUNITY_EMPTY_STATES.attachments} /><PublicResource title="Liens vérifiés" items={links} empty={OPPORTUNITY_EMPTY_STATES.verifiedLinks} links /></div></div>
  </article>;
}

function PublicResource({ title, items, empty, links = false }: { title: string; items: string[]; empty: string; links?: boolean }) {
  return <section className="rounded-2xl bg-[#f6f0e8] p-4"><h3 className="text-sm font-semibold text-[#2f3437]">{title}</h3>{items.length ? <ul className="mt-2 space-y-1.5 text-sm text-[#5f5650]">{items.map((item) => <li key={item}>{links ? <a href={item} target="_blank" rel="noreferrer" className="underline">{item}</a> : item}</li>)}</ul> : <p className="mt-2 text-sm text-[#8a837c]">{empty}</p>}</section>;
}
