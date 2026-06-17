"use client";

import { useRef, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { buildGeneratedSecureLink, buildSecureLinkListingPreview, secureLinkGenerationState } from "@/lib/secure-link-preview";

type RelationTemplateOption = {
  id: string;
  key: string;
  name: string;
  status: string;
  activeVersion: { version: number; createdAt: string } | null;
  steps: Array<{ step: number; fields: Array<{ key: string; label: string; type: string; required: boolean }> }>;
  rules: string[];
  photos: string[];
  attachments: string[];
  verifiedLinks: string[];
  announcementTitle: string;
  announcementCity: string;
  announcementDescription: string;
  objectives: string[];
  verificationRequired: boolean;
};

export function NewLinkForm({ templates, defaultTemplateId }: { templates: RelationTemplateOption[]; defaultTemplateId: string | null }) {
  const toast = useToast();
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const initialTemplate = templates.find((template) => template.id === defaultTemplateId) ?? templates[0] ?? null;
  const [form, setForm] = useState({ title: initialTemplate?.announcementTitle ?? "", city: initialTemplate?.announcementCity ?? "", description: initialTemplate?.announcementDescription ?? "", templateId: initialTemplate?.id ?? defaultTemplateId ?? "", requireEmail: true, requireMessage: true, allowDocument: true });
  const selectedTemplate = templates.find((template) => template.id === form.templateId) ?? templates[0] ?? null;
  const preview = buildSecureLinkListingPreview({ title: form.title, city: form.city, description: form.description, template: selectedTemplate });
  const generationState = secureLinkGenerationState(generatedUrl);

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Ajoutez un titre avant de générer le lien.");
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setCreating(true);
    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, suppressNotification: true }),
      });
      if (!response.ok) {
        toast.error("Le lien sécurisé n'a pas pu être généré.");
        return;
      }
      const link = await response.json() as { slug: string };
      setGeneratedUrl(buildGeneratedSecureLink(window.location.origin, link.slug));
      toast.success("Lien sécurisé généré. Aucun message n'a été envoyé.");
    } catch {
      toast.error("Le lien sécurisé n'a pas pu être généré.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div ref={editorRef} id="link-editor" className="scroll-mt-6 space-y-4 rounded-2xl border bg-white p-6">
        <input className="w-full rounded-xl border px-4 py-3" placeholder={t("links.new.titlePlaceholder")} value={form.title} onChange={(event) => { setForm({ ...form, title: event.target.value }); setGeneratedUrl(null); }} />
        <input className="w-full rounded-xl border px-4 py-3" placeholder={t("links.new.cityPlaceholder")} value={form.city} onChange={(event) => { setForm({ ...form, city: event.target.value }); setGeneratedUrl(null); }} />
        <textarea className="min-h-28 w-full rounded-xl border px-4 py-3" placeholder={t("links.new.descriptionPlaceholder")} value={form.description} onChange={(event) => { setForm({ ...form, description: event.target.value }); setGeneratedUrl(null); }} />
        <select className="w-full rounded-xl border px-4 py-3" value={form.templateId} onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); setForm({ ...form, templateId: event.target.value, title: template?.announcementTitle ?? form.title, city: template?.announcementCity ?? form.city, description: template?.announcementDescription ?? form.description }); setGeneratedUrl(null); }}>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({template.key}) - {template.status}</option>)}
        </select>
      </div>

      <section ref={previewRef} id="announcement-preview" className="scroll-mt-6">
        <h2 className="text-xl font-bold text-slate-950">Aperçu de l’annonce</h2>
        <p className="mt-1 text-sm text-slate-500">Voici ce que verront les personnes qui ouvriront le lien sécurisé.</p>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#d6e7e8] bg-white shadow-[0_20px_55px_rgba(38,56,70,0.10)]">
          {preview.photos[0] ? <div className="h-56 bg-slate-100 bg-cover bg-center" style={{ backgroundImage: `url("${preview.photos[0].replace(/"/g, "\\\"")}")` }} role="img" aria-label="Photo de l'annonce" /> : <div className="flex h-44 items-center justify-center bg-gradient-to-br from-[#263846] to-[#247f88] text-sm font-medium text-white/80">Photo de l'opportunité</div>}
          <div className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#247f88]">{preview.journeyName}</p><h3 className="mt-2 text-2xl font-bold text-[#2f3437]">{preview.title}</h3><p className="mt-1 text-sm font-medium text-[#746d66]">{preview.city}</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">Brouillon</span></div>
            <p className="mt-4 leading-relaxed text-[#3f4548]">{preview.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">{preview.badges.map((badge) => <span key={badge} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${badge.includes("vérifiée") || badge === "Lien vérifié" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : badge === "Vérification requise" || badge.includes("non vérifié") ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-cyan-50 text-cyan-800 ring-cyan-200"}`}>{badge}</span>)}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AssetList title="Pièces jointes" items={preview.attachments} empty="Aucune pièce jointe" />
              <AssetList title="Liens vérifiés" items={preview.verifiedLinks} empty="Aucun lien vérifié" links />
            </div>
          </div>
        </div>
      </section>

      {selectedTemplate ? <section className="rounded-2xl border bg-slate-50 p-5"><h2 className="text-lg font-semibold">Processus de suivi</h2><p className="mt-1 text-sm text-slate-500">Le parcours associé organise la réponse sans exposer sa structure technique.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><AssetList title="Étapes prévues" items={selectedTemplate.steps.map((step) => `Étape ${step.step}`)} empty="Aucune étape prévue" /><AssetList title="Objectifs de la recherche" items={selectedTemplate.objectives} empty="Aucun objectif ajouté" /></div><details className="mt-4 rounded-xl border bg-white p-3 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-slate-700">Vue avancée du parcours</summary><p className="mt-2">Version et règles techniques réservées à l'administration du parcours.</p></details></section> : null}

      <section className="space-y-3 rounded-2xl border bg-white p-6">
        <label className="flex gap-2"><input type="checkbox" checked={form.requireEmail} onChange={(event) => { setForm({ ...form, requireEmail: event.target.checked }); setGeneratedUrl(null); }} />{t("links.new.requireEmail")}</label>
        <label className="flex gap-2"><input type="checkbox" checked={form.requireMessage} onChange={(event) => { setForm({ ...form, requireMessage: event.target.checked }); setGeneratedUrl(null); }} />{t("links.new.requireMessage")}</label>
        <label className="flex gap-2"><input type="checkbox" checked={form.allowDocument} onChange={(event) => { setForm({ ...form, allowDocument: event.target.checked }); setGeneratedUrl(null); }} />{t("links.new.allowDocument")}</label>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <button type="button" onClick={() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700">Modifier</button>
          <button type="button" onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">Prévisualiser</button>
          <button type="button" onClick={() => void submit()} disabled={creating} className="flex-1 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{creating ? "Génération..." : "Générer le lien sécurisé"}</button>
        </div>
      </section>

      {generationState === "GENERATED" && generatedUrl ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" aria-live="polite"><p className="font-semibold text-emerald-900">Lien sécurisé généré</p><p className="mt-1 text-sm text-emerald-800">Le lien est prêt. Aucune publication ou prise de contact automatique n'a été effectuée.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input readOnly value={generatedUrl} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm" /><CopyLinkButton value={generatedUrl} /></div></section> : null}
    </div>
  );
}

function AssetList({ title, items, empty, links = false }: { title: string; items: string[]; empty: string; links?: boolean }) {
  return <div className="rounded-2xl bg-[#f6f0e8] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#746d66]">{title}</p>{items.length ? <ul className="mt-2 space-y-1 text-sm text-[#3f4548]">{items.map((item) => <li key={item}>{links ? <a href={item} target="_blank" rel="noreferrer" className="underline">{item}</a> : item}</li>)}</ul> : <p className="mt-2 text-sm text-[#8a837c]">{empty}</p>}</div>;
}
