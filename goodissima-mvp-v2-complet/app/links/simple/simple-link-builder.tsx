"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { describeSimpleFieldRule, type SimpleFieldRule, type SimpleRuleOperator } from "@/lib/simple-field-rules";
import {
  simpleLinkTemplateCategories,
  simpleLinkTemplates,
  type SimpleLinkTemplate,
  type SimpleLinkTemplateCategory,
} from "@/lib/simple-link-templates";

type FieldType = "SECTION" | "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "NUMBER" | "DATE" | "SELECT" | "MULTISELECT" | "FILE" | "CHECKBOX";
type Field = { id: string; label: string; type: FieldType; required: boolean; options: string[]; validationRules?: SimpleFieldRule };

const fieldTypes: Array<{ value: FieldType; label: string }> = [
  { value: "SECTION", label: "Titre de section" },
  { value: "TEXT", label: "Texte court" }, { value: "TEXTAREA", label: "Texte long" },
  { value: "PHONE", label: "Téléphone" },
  { value: "NUMBER", label: "Nombre" }, { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Choix unique" }, { value: "MULTISELECT", label: "Choix multiple" }, { value: "FILE", label: "Fichier" },
  { value: "CHECKBOX", label: "Case à cocher" },
];

const starter: Field[] = [
  { id: crypto.randomUUID(), label: "Nom complet", type: "TEXT", required: true, options: [] },
];

function blankField(): Field {
  return { id: crypto.randomUUID(), label: "", type: "TEXT", required: false, options: [] };
}

const ruleLabels: Array<{ value: SimpleRuleOperator; label: string }> = [
  { value: "NONE", label: "Aucun critère" }, { value: "LT", label: "Inférieur à" },
  { value: "LTE", label: "Inférieur ou égal à" }, { value: "GT", label: "Supérieur à" },
  { value: "GTE", label: "Supérieur ou égal à" }, { value: "BETWEEN", label: "Entre" },
  { value: "CONTAINS", label: "Contient" }, { value: "MIN_LENGTH", label: "Longueur minimale" },
  { value: "MAX_LENGTH", label: "Longueur maximale" }, { value: "CITY_EXACT", label: "Ville exacte" },
  { value: "CITY_RADIUS", label: "Rayon autour d’une ville" }, { value: "EMAIL_FORMAT", label: "Format email" },
  { value: "PHONE_FORMAT", label: "Format téléphone" }, { value: "DATE_BEFORE", label: "Avant" },
  { value: "DATE_AFTER", label: "Après" }, { value: "DATE_BETWEEN", label: "Entre deux dates" },
  { value: "REQUIRED_OPTION", label: "Option obligatoire" }, { value: "MAX_CHOICES", label: "Nombre maximum de choix" },
];

export function SimpleLinkBuilder() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [fields, setFields] = useState<Field[]>(starter);
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [createdLinkId, setCreatedLinkId] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiFieldsAdded, setAiFieldsAdded] = useState(false);
  const [aiNeed, setAiNeed] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [admissionMode, setAdmissionMode] = useState<"OPEN" | "VERIFIED_ONLY">("OPEN");
  const [allowDocument, setAllowDocument] = useState(false);
  const [requireMessage, setRequireMessage] = useState(false);
  const [enhancedSecurity, setEnhancedSecurity] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState<SimpleLinkTemplateCategory | "Toutes">("Toutes");
  const [importedTemplateTitle, setImportedTemplateTitle] = useState("");
  const [matchingRecommended, setMatchingRecommended] = useState(false);
  const [matchingEnabled, setMatchingEnabled] = useState(false);

  const validFields = useMemo(() => fields.filter((field) => field.label.trim()), [fields]);
  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLocaleLowerCase();
    return simpleLinkTemplates.filter((item) =>
      (templateCategory === "Toutes" || item.category === templateCategory) &&
      (!query || `${item.title} ${item.description} ${item.tags.join(" ")}`.toLocaleLowerCase().includes(query)),
    );
  }, [templateCategory, templateSearch]);
  function update(id: string, patch: Partial<Field>) {
    setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field));
    setValidated(false);
  }
  function move(index: number, delta: number) {
    const next = [...fields]; const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next); setValidated(false);
  }
  function proposeFields() {
    const need = aiNeed.toLowerCase();
    const labels = need.includes("garage")
      ? ["Nom complet", "Téléphone", "Ville ou secteur recherché", "Type de garage", "Budget", "Message libre"]
      : ["Nom complet", "Téléphone", "Votre besoin", "Message libre"];
    setFields(labels.map((label, index) => ({
      id: crypto.randomUUID(), label,
      type: label === "Téléphone" ? "PHONE" : label.includes("Budget") ? "NUMBER" : label.includes("Message") || label.includes("besoin") ? "TEXTAREA" : "TEXT",
      required: index < 2, options: [],
    })));
    setAiFieldsAdded(true);
    setValidated(false);
  }
  function useTemplate(selected: SimpleLinkTemplate) {
    setTitle(selected.title);
    setDescription(selected.description);
    setWelcomeMessage(selected.welcomeMessage);
    setFields(selected.fields.filter((field) => field.type !== "EMAIL").map((field) => ({
      id: crypto.randomUUID(),
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options ? [...field.options] : [],
      validationRules: field.validationRules ? { ...field.validationRules } : undefined,
    })));
    setImportedTemplateTitle(selected.title);
    setMatchingRecommended(selected.matchingRecommended === true);
    setValidated(false);
    setPublicUrl("");
    setShowTemplates(false);
  }
  async function createLink() {
    setError(""); setLoading(true);
    try {
      const response = await fetch("/api/links/simple", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, welcomeMessage, fields: validFields, humanValidated: validated,
          expiresAt, admissionMode, allowDocument, requireMessage, enhancedSecurity,
          matchingEnabled,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible de créer le lien.");
      setPublicUrl(result.publicUrl);
      setCreatedLinkId(result.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de créer le lien.");
    } finally { setLoading(false); }
  }

  return (
    <div data-boussole-id="simple-link-builder" data-boussole-state={publicUrl ? matchingEnabled ? "created-matching" : "created" : importedTemplateTitle ? "template-imported" : "editing"}>
      <header className="rounded-3xl bg-gradient-to-br from-[#0f5960] via-[#247f88] to-[#48a7a2] p-7 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Création rapide</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Créer un lien simple</h1>
            <p className="mt-3 max-w-2xl text-white/85">Construisez un formulaire sécurisé en quelques minutes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-boussole-id="preview-simple-link" onClick={() => document.getElementById("simple-link-preview")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-bold">Prévisualiser</button>
            <button type="button" onClick={() => document.getElementById("simple-link-publication")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#17656d]">Créer le lien</button>
          </div>
        </div>
      </header>

      <section data-boussole-id="choose-simple-link-template" data-boussole-state={importedTemplateTitle ? "imported" : showTemplates ? "gallery-open" : "not-imported"} className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#247f88]">Bibliothèque officielle Goodissima</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Partir d’un modèle</h2>
            <p className="mt-1 text-sm text-slate-500">Choisissez un formulaire prêt à adapter, puis modifiez librement chaque champ.</p>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowTemplates(!showTemplates)} className="rounded-xl border border-[#247f88] px-4 py-2.5 text-sm font-bold text-[#247f88]">
            {showTemplates ? "Fermer la bibliothèque" : "Choisir un modèle"}
          </button><button type="button" data-boussole-id="create-without-template" data-boussole-state={importedTemplateTitle ? "imported" : "not-imported"} onClick={() => document.querySelector('[data-boussole-id="simple-link-title"]')?.scrollIntoView({ behavior: "smooth", block: "center" })} className="rounded-xl border px-4 py-2.5 text-sm font-bold text-slate-700">Créer sans modèle</button></div>
        </div>
        {importedTemplateTitle ? <div className="mt-4 space-y-2"><p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Modèle « {importedTemplateTitle} » importé, vous pouvez le modifier.</p>{matchingRecommended ? <p data-boussole-id="simple-link-matching-recommendation" data-boussole-state="recommended" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">Matching recommandé pour ce modèle. Il reste désactivé tant que vous ne l’activez pas explicitement.</p> : null}</div> : null}
        {showTemplates ? <div className="mt-6 border-t pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_280px]">
            <input data-boussole-id="search-simple-link-template" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Rechercher : baby-sitter, voiture, document…" className="rounded-xl border px-4 py-3 text-sm" />
            <select data-boussole-id="filter-simple-link-template" value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value as SimpleLinkTemplateCategory | "Toutes")} className="rounded-xl border px-4 py-3 text-sm">
              <option value="Toutes">Toutes les catégories</option>
              {simpleLinkTemplateCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <p className="mt-4 text-sm text-slate-500">{filteredTemplates.length} modèle{filteredTemplates.length > 1 ? "s" : ""} officiel{filteredTemplates.length > 1 ? "s" : ""}</p>
          <div className="mt-4 grid max-h-[620px] gap-4 overflow-y-auto pr-2 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((item) => <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#247f88] ring-1 ring-slate-200">{item.category}</span>
              <h3 className="mt-3 font-bold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">{item.fields.length} champs · {item.fields.filter((field) => field.required).length} obligatoires</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500">#{tag}</span>)}</div>
              <p className="mt-3 line-clamp-2 text-xs text-slate-500">{item.fields.slice(0, 5).map((field) => field.label).join(" · ")}{item.fields.length > 5 ? "…" : ""}</p>
              {item.helpText ? <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">{item.helpText}</p> : null}
              <button type="button" data-boussole-id="use-simple-link-template" onClick={() => useTemplate(item)} className="mt-auto pt-5 text-left text-sm font-bold text-[#247f88]">Utiliser ce modèle →</button>
            </article>)}
          </div>
          {filteredTemplates.length === 0 ? <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Aucun modèle ne correspond à cette recherche.</p> : null}
          <p className="mt-5 text-xs text-slate-500">Importer un modèle ne crée aucun lien. La vérification humaine reste obligatoire.</p>
        </div> : null}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <div className="space-y-6">
          <section data-boussole-id="edit-simple-link-information" className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Informations du lien</h2>
            <div className="mt-5 grid gap-4">
              <label data-boussole-id="simple-link-title" className="text-sm font-semibold text-slate-700">Titre du lien
                <input value={title} onChange={(e) => { setTitle(e.target.value); setValidated(false); }} placeholder="Ex. Recherche d’un garage à louer" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
              </label>
              <label data-boussole-id="simple-link-description" className="text-sm font-semibold text-slate-700">Description courte
                <textarea value={description} onChange={(e) => { setDescription(e.target.value); setValidated(false); }} rows={2} placeholder="Expliquez simplement l’objet de la collecte." className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
              </label>
              <label data-boussole-id="simple-link-welcome-message" className="text-sm font-semibold text-slate-700">Message d’accueil candidat
                <textarea value={welcomeMessage} onChange={(e) => { setWelcomeMessage(e.target.value); setValidated(false); }} rows={2} placeholder="Quelques mots pour accueillir et rassurer." className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
              </label>
            </div>
          </section>

          <section data-boussole-id="simple-link-fields" className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-xl font-bold">Champs à collecter</h2><p className="mt-1 text-sm text-slate-500">Modifiez les cellules directement, comme dans un tableau.</p></div>
              <button type="button" data-boussole-id="suggest-fields-with-ai" data-boussole-state={aiFieldsAdded ? "fields-added" : "available"} onClick={() => setShowAi(!showAi)} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900">✨ Proposer des champs avec l’IA</button>
            </div>
            {showAi && <div className="border-b bg-violet-50/70 p-5">
              <p className="text-sm font-semibold text-violet-950">Décrivez votre besoin en une phrase</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={aiNeed} onChange={(e) => setAiNeed(e.target.value)} placeholder="Je cherche un garage à louer." className="flex-1 rounded-xl border border-violet-200 px-4 py-2.5" /><button type="button" onClick={proposeFields} disabled={!aiNeed.trim()} className="rounded-xl bg-violet-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Ajouter ces champs</button></div>
              <p className="mt-2 text-xs text-violet-700">Proposition courte uniquement. Vous gardez la main sur chaque champ.</p>
            </div>}
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[44px_1fr_180px_110px_1fr_110px_118px] gap-2 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span>#</span><span>Libellé</span><span>Type</span><span>Obligatoire</span><span>Options</span><span>Règles</span><span>Actions</span>
                </div>
                {fields.map((field, index) => <div key={field.id} className="grid grid-cols-[44px_1fr_180px_110px_1fr_110px_118px] items-center gap-2 border-t px-4 py-3">
                  <span className="text-sm font-bold text-slate-400">{index + 1}</span>
                  <input data-boussole-id={index === 0 ? "simple-link-field-label" : undefined} aria-label={`Libellé du champ ${index + 1}`} value={field.label} onChange={(e) => update(field.id, { label: e.target.value })} placeholder="Nouveau champ" className="rounded-lg border px-3 py-2 text-sm" />
                  <select data-boussole-id={index === 0 ? "simple-link-field-type" : undefined} value={field.type} onChange={(e) => update(field.id, { type: e.target.value as FieldType })} className="rounded-lg border px-3 py-2 text-sm">{fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
                  <label data-boussole-id={index === 0 ? "simple-link-field-required" : undefined} className="flex justify-center"><input type="checkbox" disabled={field.type === "SECTION"} checked={field.required} onChange={(e) => update(field.id, { required: e.target.checked })} className="h-5 w-5 accent-[#247f88] disabled:opacity-30" /></label>
                  {field.type === "SELECT" || field.type === "MULTISELECT" ? <input value={field.options.join(", ")} onChange={(e) => update(field.id, { options: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Option 1, Option 2" className="rounded-lg border px-3 py-2 text-sm" /> : <span className="text-xs text-slate-400">—</span>}
                  {field.type === "SECTION" ? <span className="text-xs text-slate-400">—</span> : <button type="button" data-boussole-id="add-simple-link-rule" onClick={() => update(field.id, { validationRules: field.validationRules ? undefined : { operator: "NONE", mode: "INDICATIVE" } })} className="rounded-lg border px-2 py-2 text-xs font-semibold text-slate-700">{field.validationRules ? "Modifier" : "+ Règle"}</button>}
                  <div className="flex gap-1">
                    <button data-boussole-id={index === 0 && fields.length > 1 ? "reorder-simple-link-field" : undefined} title="Monter" type="button" onClick={() => move(index, -1)} className="rounded-lg border px-2 py-1">↑</button>
                    <button title="Descendre" type="button" onClick={() => move(index, 1)} className="rounded-lg border px-2 py-1">↓</button>
                    <button data-boussole-id={index === 0 ? "duplicate-simple-link-field" : undefined} title="Dupliquer" type="button" onClick={() => setFields((current) => [...current.slice(0, index + 1), { ...field, id: crypto.randomUUID() }, ...current.slice(index + 1)])} className="rounded-lg border px-2 py-1">⧉</button>
                    <button data-boussole-id={index === 0 ? "delete-simple-link-field" : undefined} title="Supprimer" type="button" onClick={() => { setFields(fields.filter((item) => item.id !== field.id)); setValidated(false); }} className="rounded-lg border px-2 py-1 text-red-600">×</button>
                  </div>
                  {field.validationRules && field.type !== "SECTION" ? <div className="col-start-2 col-span-5 grid gap-2 rounded-xl bg-amber-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
                    <select data-boussole-id={index === 0 ? "simple-link-rule-operator" : undefined} value={field.validationRules.operator} onChange={(event) => update(field.id, { validationRules: { ...field.validationRules!, operator: event.target.value as SimpleRuleOperator } })} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm">{ruleLabels.map((rule) => <option key={rule.value} value={rule.value}>{rule.label}</option>)}</select>
                    {field.validationRules.operator === "CITY_RADIUS" ? <>
                      <input value={field.validationRules.city ?? ""} onChange={(event) => update(field.id, { validationRules: { ...field.validationRules!, city: event.target.value, declarative: true } })} placeholder="Ville de référence" className="rounded-lg border border-amber-200 px-3 py-2 text-sm" />
                      <input type="number" min="1" value={field.validationRules.radiusKm ?? ""} onChange={(event) => update(field.id, { validationRules: { ...field.validationRules!, radiusKm: Number(event.target.value), declarative: true } })} placeholder="Rayon en km" className="rounded-lg border border-amber-200 px-3 py-2 text-sm" />
                    </> : !["NONE", "EMAIL_FORMAT", "PHONE_FORMAT"].includes(field.validationRules.operator) ? <>
                      <input data-boussole-id={index === 0 ? "simple-link-rule-value" : undefined} value={field.validationRules.value ?? ""} onChange={(event) => update(field.id, { validationRules: { ...field.validationRules!, value: event.target.value } })} placeholder="Valeur" className="rounded-lg border border-amber-200 px-3 py-2 text-sm" />
                      {["BETWEEN", "DATE_BETWEEN"].includes(field.validationRules.operator) ? <input value={field.validationRules.value2 ?? ""} onChange={(event) => update(field.id, { validationRules: { ...field.validationRules!, value2: event.target.value } })} placeholder="Valeur maximum" className="rounded-lg border border-amber-200 px-3 py-2 text-sm" /> : null}
                    </> : null}
                    <select data-boussole-id={index === 0 ? "simple-link-rule-mode" : undefined} value={field.validationRules.mode} onChange={(event) => update(field.id, { validationRules: { ...field.validationRules!, mode: event.target.value === "BLOCKING" ? "BLOCKING" : "INDICATIVE" } })} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"><option value="INDICATIVE">Indicative</option><option value="BLOCKING">Bloquante</option></select>
                    <button type="button" onClick={() => update(field.id, { validationRules: undefined })} className="rounded-lg px-3 py-2 text-xs font-semibold text-red-700">Retirer</button>
                    {field.validationRules.operator !== "NONE" ? <p data-boussole-id={index === 0 ? "simple-link-rule-summary" : undefined} className="col-span-full text-xs font-medium text-amber-950">{describeSimpleFieldRule(field)} · {field.validationRules.mode === "BLOCKING" ? "Envoi bloqué si non respectée" : "Écart à examiner, envoi autorisé"}</p> : null}
                  </div> : null}
                </div>)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t p-4">
              <button type="button" data-boussole-id="add-simple-link-field" onClick={() => { setFields([...fields, blankField()]); setValidated(false); }} className="rounded-xl border border-dashed border-[#247f88] px-4 py-2.5 text-sm font-bold text-[#247f88]">+ Ajouter un champ</button>
              <button type="button" data-boussole-id="add-simple-link-section" onClick={() => { setFields([...fields, { ...blankField(), type: "SECTION", label: "Nouvelle section" }]); setValidated(false); }} className="rounded-xl border border-dashed border-slate-400 px-4 py-2.5 text-sm font-bold text-slate-700">+ Ajouter une section</button>
            </div>
          </section>

          <details data-boussole-id="simple-link-advanced-options" className="group rounded-3xl border bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between p-6 font-bold text-slate-900">
              <span>Options avancées</span><span className="text-xl text-slate-400 group-open:rotate-45">+</span>
            </summary>
            <div className="grid gap-5 border-t p-6 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Expiration
                <input type="date" value={expiresAt} onChange={(event) => { setExpiresAt(event.target.value); setValidated(false); }} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Admission
                <select value={admissionMode} onChange={(event) => { setAdmissionMode(event.target.value as "OPEN" | "VERIFIED_ONLY"); setValidated(false); }} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal">
                  <option value="OPEN">Ouverte</option>
                  <option value="VERIFIED_ONLY">Restreinte aux identités vérifiées</option>
                </select>
              </label>
              <label className="flex items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={allowDocument} onChange={(event) => { setAllowDocument(event.target.checked); setValidated(false); }} className="mt-0.5 h-4 w-4" /><span><strong>Document optionnel</strong><span className="block text-xs text-slate-500">Autoriser une pièce complémentaire.</span></span></label>
              <label className="flex items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={requireMessage} onChange={(event) => { setRequireMessage(event.target.checked); setValidated(false); }} className="mt-0.5 h-4 w-4" /><span><strong>Message obligatoire</strong><span className="block text-xs text-slate-500">Demander une explication avec la réponse.</span></span></label>
              <label className="flex items-start gap-3 rounded-xl border p-4 text-sm sm:col-span-2"><input type="checkbox" checked={enhancedSecurity} onChange={(event) => { setEnhancedSecurity(event.target.checked); setValidated(false); }} className="mt-0.5 h-4 w-4" /><span><strong>Paramètres avancés de sécurité</strong><span className="block text-xs text-slate-500">Renforcer les contrôles sans créer de workflow ou d’invitation.</span></span></label>
            </div>
          </details>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section id="simple-link-preview" data-boussole-id="simple-link-live-preview" className="scroll-mt-6 rounded-3xl border bg-slate-100 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Ce que verra la personne qui ouvre le lien</h2><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Aperçu live</span></div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="h-1.5 rounded-full bg-[#247f88]" /><h3 className="mt-5 text-2xl font-bold">{title || "Titre de votre formulaire"}</h3>
              <p className="mt-2 text-sm text-slate-500">{welcomeMessage || description || "Votre message d’accueil apparaîtra ici."}</p>
              <div className="mt-6 space-y-5">{validFields.length ? validFields.map((field) => field.type === "SECTION" ? <div key={field.id} className="border-b pb-2 pt-3 text-lg font-bold text-slate-900">{field.label}</div> : <div key={field.id}>
                <p className="text-sm font-semibold">{field.label}{field.required && <span className="text-red-600"> *</span>}</p>
                {field.validationRules?.operator !== "NONE" && describeSimpleFieldRule(field) ? <p className="mt-1 text-xs text-amber-700">{describeSimpleFieldRule(field)} · {field.validationRules?.mode === "BLOCKING" ? "Règle bloquante" : "Critère indicatif"}</p> : null}
                {field.type === "TEXTAREA" ? <div className="mt-2 h-20 rounded-xl border bg-slate-50" /> : field.type === "CHECKBOX" ? <div className="mt-2 flex items-center gap-2 text-sm text-slate-500"><span className="h-4 w-4 rounded border" /> Oui, je confirme</div> : <div className="mt-2 h-11 rounded-xl border bg-slate-50 px-3 py-3 text-xs text-slate-400">{field.type === "SELECT" ? "Sélectionner une option" : field.type === "MULTISELECT" ? "Sélectionner plusieurs options" : field.type === "FILE" ? "Choisir un fichier" : ""}</div>}
              </div>) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">Ajoutez un champ pour voir le formulaire prendre forme.</div>}</div>
              <button type="button" disabled className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Envoyer ma réponse</button>
            </div>
          </section>
          <section data-boussole-id="enable-link-matching" data-boussole-state={matchingEnabled ? "enabled" : "disabled"} className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
            <h2 className="font-bold text-cyan-950">Matching relationnel</h2>
            <label className="mt-4 flex items-start gap-3 text-sm text-cyan-950">
              <input type="checkbox" checked={matchingEnabled} onChange={(event) => { setMatchingEnabled(event.target.checked); setValidated(false); }} className="mt-0.5 h-5 w-5 accent-[#247f88]" />
              <span><strong>Rechercher des correspondances pour ce lien</strong><span data-boussole-id="simple-link-matching-help" className="mt-1 block text-xs leading-relaxed text-cyan-800">Goodissima comparera les critères de ce lien avec les opportunités existantes. Aucun contact, email ou dossier ne sera créé automatiquement.</span></span>
            </label>
          </section>
          <section id="simple-link-publication" data-boussole-id="simple-link-final-check-section" data-boussole-state={validated ? "confirmed" : "unconfirmed"} className="scroll-mt-6 rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold">Dernière vérification</h2>
            <label data-boussole-id="confirm-simple-link" data-boussole-state={validated ? "confirmed" : "unconfirmed"} className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} className="mt-0.5 h-4 w-4" /><span><strong>J’ai vérifié les champs et je confirme la création du lien.</strong><br />Aucune diffusion ne sera faite automatiquement.</span></label>
            <button type="button" data-boussole-id="create-simple-link" data-boussole-state={publicUrl ? "created" : loading ? "creating" : validated && title.trim() && validFields.length ? "ready" : "disabled"} onClick={createLink} disabled={loading || !validated || !title.trim() || !validFields.length} className="mt-4 w-full rounded-xl bg-[#247f88] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Création…" : "Créer le lien"}</button>
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {publicUrl && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-950">Votre lien est prêt</p><p className="mt-2 break-all text-xs text-emerald-800">{publicUrl}</p><div className="mt-3 flex gap-2"><button type="button" data-boussole-id="copy-public-link" onClick={async () => { await navigator.clipboard.writeText(publicUrl); setCopied(true); }} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">{copied ? "Copié !" : "Copier le lien"}</button><a data-boussole-id="open-public-link" href={publicUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900">Ouvrir</a></div></div>}
          </section>
          {createdLinkId && matchingEnabled ? <section className="flex flex-wrap gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><Link data-boussole-id="open-link-matching" data-boussole-state="created-matching" href={`/links/${createdLinkId}#matching`} className="rounded-lg bg-cyan-900 px-3 py-2 text-xs font-bold text-white">Ouvrir le matching</Link><Link data-boussole-id="open-pilotage-matching-signal" href="/gouvernance/pilotage" className="rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-900">Salle de pilotage</Link></section> : null}
          <section data-boussole-id="simple-link-governance-reminder" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Besoin d’un processus structuré avec pilotage, invitations ou revues ? <Link href="/gouvernance/nouveau" className="font-bold text-[#247f88]">Utilisez Gouvernance → Créer un parcours gouverné.</Link></section>
          <section className="rounded-2xl border border-dashed p-4"><p className="text-sm font-bold text-slate-700">Correspondances potentielles à examiner</p><p className="mt-1 text-xs text-slate-500">Emplacement prévu pour le pré-matching. Aucun contact automatique.</p></section>
        </aside>
      </div>
    </div>
  );
}
