"use client";

import { useState } from "react";
import { OpportunityPreviewActions } from "@/components/OpportunityPreviewActions";
import {
  OPPORTUNITY_PREVIEW_TABS,
  OPPORTUNITY_EMPTY_STATES,
  opportunityHeroImage,
  type OpportunityPreview,
} from "@/lib/opportunity-preview";
import { productObjectDefinitions, productObjectGuidance } from "@/lib/product-object-clarity";
import {
  ANNOUNCEMENT_PUBLICATION_SUCCESS,
  applyAnnouncementPublication,
  announcementPublicationState,
  type AnnouncementPublicationResult,
} from "@/lib/announcement-publication";

type TabId = (typeof OPPORTUNITY_PREVIEW_TABS)[number]["id"];

function PreviewList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><h3 className="text-sm font-semibold text-slate-800">{title}</h3>{items.length ? <ul className="mt-2 space-y-1.5 text-sm text-slate-600">{items.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">{empty}</p>}</div>;
}

export function OpportunityPreviewCard({ preview, templateId, relationTemplateId, returnHref, created }: { preview: OpportunityPreview; templateId: string; relationTemplateId: string; returnHref: string; created: boolean }) {
  const [activeTab, setActiveTab] = useState<TabId>("announcement");
  const [publication, setPublication] = useState(() => announcementPublicationState({ isPublished: preview.status === "PUBLISHED", publishedAt: preview.publishedAt }));
  const [publicationSucceeded, setPublicationSucceeded] = useState(false);
  const heroImage = opportunityHeroImage(preview);

  function handlePublished(result: AnnouncementPublicationResult) {
    setPublication(applyAnnouncementPublication(result));
    setPublicationSucceeded(true);
  }

  const trustIndicators = preview.trustIndicators.map((item) => {
    if (publication.status === "PUBLISHED" && item === "Non publiée") return "Publication enregistrée";
    return item;
  });

  return <section className="mt-6 overflow-hidden rounded-3xl border border-[#d6e7e8] bg-white shadow-[0_20px_60px_rgba(38,56,70,0.12)]">
    {created ? <div className="bg-emerald-700 px-6 py-3 text-sm font-semibold text-white">Brouillon créé avec succès.</div> : null}
    {publicationSucceeded ? <div className="bg-emerald-700 px-6 py-3 text-sm font-semibold text-white" role="status">{ANNOUNCEMENT_PUBLICATION_SUCCESS}</div> : null}
    <div className="relative min-h-[31rem] bg-slate-900 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(90deg, rgba(20,32,40,.90), rgba(20,32,40,.18)), url("${heroImage.replace(/"/g, "\\\"")}")` }}>
      <div className="flex min-h-[31rem] max-w-4xl flex-col justify-end p-6 text-white sm:p-10">
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{publication.publicationStatus}</span><span className={`rounded-full px-3 py-1 text-xs font-bold backdrop-blur ${preview.readiness === "Prêt à publier" ? "bg-emerald-400/25 text-emerald-50" : preview.readiness === "Presque prêt" ? "bg-amber-300/25 text-amber-50" : "bg-white/15 text-white"}`}>{preview.readiness}</span>{trustIndicators.map((item) => <span key={item} className="rounded-full bg-cyan-300/20 px-3 py-1 text-xs font-medium text-cyan-50 backdrop-blur">{item}</span>)}</div>
        {publication.publishedAt ? <p className="mt-3 text-sm text-white/75">Publiée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(publication.publishedAt))}</p> : null}
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{preview.propertyType}</p>
        <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{preview.title}</h1>
        <p className="mt-3 text-xl font-medium text-white/90">{preview.subtitle}</p>
        <p className="mt-2 text-base text-white/75">{preview.city}</p>
        <div className="mt-5 flex flex-wrap gap-2">{preview.highlights.map((highlight) => <span key={highlight} className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-800">✓ {highlight}</span>)}</div>
      </div>
    </div>

    <div className="p-6 sm:p-8">
      <p className="text-sm font-medium text-[#247f88]">Voici l'opportunité générée à partir de votre description.</p>
      <p className="mt-2 text-sm text-slate-500">{productObjectDefinitions.announcement}</p>
      <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">{productObjectGuidance.announcement}</div>
      <p className="mt-5 max-w-4xl text-lg leading-relaxed text-slate-700">{preview.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">{preview.highlights.map((highlight) => <span key={highlight} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">✓ {highlight}</span>)}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{preview.keyMetrics.map((metric) => <div key={metric.label} className="rounded-2xl bg-[#f6f0e8] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#746d66]">{metric.label}</p><p className="mt-1 text-lg font-bold text-[#2f3437]">{metric.value}</p></div>)}</div>

      <div className="mt-7 flex gap-2 overflow-x-auto border-b" role="tablist" aria-label="Détails de l'opportunité">
        {OPPORTUNITY_PREVIEW_TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === tab.id ? "border-[#247f88] text-[#245f66]" : "border-transparent text-slate-500"}`}>{tab.label}</button>)}
      </div>

      {activeTab === "announcement" ? <div className="mt-5 grid gap-4 md:grid-cols-2"><PreviewList title="Documents partagés" items={preview.attachments} empty={OPPORTUNITY_EMPTY_STATES.attachments} /><PreviewList title="Liens vérifiés" items={preview.verifiedLinks} empty={OPPORTUNITY_EMPTY_STATES.verifiedLinks} />{preview.photos.length > 1 ? <PreviewList title="Photos complémentaires" items={preview.photos.slice(1)} empty="Aucune photo complémentaire" /> : null}</div> : null}
      {activeTab === "journey" ? <div className="mt-5 grid gap-4 md:grid-cols-2"><PreviewList title="Personnes concernées" items={preview.actors} empty="Aucune personne suggérée" /><PreviewList title="Étapes d'accompagnement" items={preview.stages} empty="Aucune étape proposée" /><PreviewList title="Documents attendus" items={preview.requiredDocuments} empty="Aucun document obligatoire" /><PreviewList title="Indicateurs de réussite" items={preview.kpis} empty="Aucun indicateur proposé" /><PreviewList title="Objectifs de la recherche" items={preview.validationCriteria} empty="Aucun objectif proposé" /></div> : null}
      {activeTab === "governance" ? <div className="mt-5 grid gap-4 md:grid-cols-2"><PreviewList title="Validation et contrôle" items={preview.governance.validation} empty="Aucune information de validation" /><PreviewList title="Provenance" items={preview.governance.provenance} empty="Aucune provenance enregistrée" /><PreviewList title="Traçabilité" items={preview.governance.audit} empty="Aucune information d'audit" /></div> : null}

      <div className="mt-7 border-t pt-5"><OpportunityPreviewActions templateId={templateId} relationTemplateId={relationTemplateId} returnHref={returnHref} isPublished={publication.status === "PUBLISHED"} onPublished={handlePublished} /></div>
    </div>
  </section>;
}
