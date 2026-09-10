"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import type { ManagedDirectoryAttributeDto, ManagedDirectoryProfileDto } from "@/lib/directory/contracts";
import type { DirectorySearchCriteria, DirectorySearchFilterKind, DirectorySearchPageDto } from "@/lib/directory/directory-search-contracts";
import * as actions from "@/app/(connected)/annuaire/actions";
import { DirectoryProfileCard } from "./DirectoryProfileCard";

const filters = [["professions", "Métier"], ["skills", "Compétence"], ["languages", "Langue"], ["locations", "Localisation"], ["qualifications", "Qualification"], ["certifications", "Certification"]] as const;
const kinds = [["PROFESSION", "Métier"], ["SKILL", "Compétence"], ["LANGUAGE", "Langue"], ["LOCATION", "Localisation"], ["QUALIFICATION", "Qualification"], ["CERTIFICATION", "Certification"]] as const;
const statusLabels = { DRAFT: "Brouillon", PUBLISHED: "Publié", WITHDRAWN: "Retiré" } as const;
type Kind = (typeof kinds)[number][0];
type FilterField = (typeof filters)[number][0];
type SearchForm = Record<FilterField, string> & { text: string; actorType: string; verifiedKinds: DirectorySearchFilterKind[] };
const emptySearch: SearchForm = { text: "", actorType: "", professions: "", skills: "", languages: "", locations: "", qualifications: "", certifications: "", verifiedKinds: [] };
const inputClass = "mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";

function splitValues(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function makeCriteria(form: SearchForm, cursor?: string): DirectorySearchCriteria {
  const criteria: DirectorySearchCriteria = { limit: 12 };
  if (form.text.trim()) criteria.text = form.text.trim();
  if (form.actorType) criteria.actorType = form.actorType as "PERSON" | "ORGANIZATION";
  for (const [field] of filters) if (splitValues(form[field]).length) criteria[field] = splitValues(form[field]);
  if (form.verifiedKinds.length) criteria.verificationRequirements = form.verifiedKinds.map((kind) => ({ kind, level: "VERIFIED" }));
  if (cursor) criteria.cursor = cursor;
  return criteria;
}

export function DirectoryExperience({ initialProfiles }: { initialProfiles: ManagedDirectoryProfileDto[] }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  useEffect(() => setProfiles(initialProfiles), [initialProfiles]);
  return <div className="mt-10 space-y-10"><DirectorySearch /><DirectoryEnrollment profiles={profiles} /></div>;
}

function DirectorySearch() {
  const [form, setForm] = useState(emptySearch);
  const [naturalQuery, setNaturalQuery] = useState("");
  const [unsupported, setUnsupported] = useState<Array<{ label: string; reason?: string }>>([]);
  const [interpretError, setInterpretError] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [page, setPage] = useState<DirectorySearchPageDto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function interpret() {
    if (!naturalQuery.trim()) return;
    setInterpreting(true); setInterpretError(""); setUnsupported([]);
    try {
      const response = await fetch("/api/directory/interpret-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: naturalQuery }) });
      const body = await response.json() as { criteria?: DirectorySearchCriteria | null; unsupportedCriteria?: Array<{ label: string; reason?: string }>; error?: string };
      if (!response.ok) throw new Error(body.error);
      const criteria = body.criteria;
      setUnsupported(body.unsupportedCriteria ?? []);
      if (!criteria) { setInterpretError("Aucun critère utilisable n’a été identifié. Vous pouvez utiliser les filtres ci-dessous."); return; }
      setForm({ text: criteria.text ?? "", actorType: criteria.actorType ?? "", professions: criteria.professions?.join(", ") ?? "", skills: criteria.skills?.join(", ") ?? "", languages: criteria.languages?.join(", ") ?? "", locations: criteria.locations?.join(", ") ?? "", qualifications: criteria.qualifications?.join(", ") ?? "", certifications: criteria.certifications?.join(", ") ?? "", verifiedKinds: criteria.verificationRequirements?.map((item) => item.kind) ?? [] });
    } catch { setInterpretError("Nous n’avons pas pu interpréter cette demande automatiquement. Vous pouvez utiliser les filtres ci-dessous."); }
    finally { setInterpreting(false); }
  }
  async function search(cursor?: string) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/directory/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(makeCriteria(form, cursor)) });
      if (!response.ok) throw new Error("search");
      const next = await response.json() as DirectorySearchPageDto;
      setPage((current) => cursor && current ? { items: [...current.items, ...next.items], nextCursor: next.nextCursor } : next);
    } catch { setError("La recherche n’a pas pu aboutir. Réessayez."); }
    finally { setLoading(false); }
  }
  const understood = Boolean(form.actorType || form.text || filters.some(([field]) => form[field]) || form.verifiedKinds.length);
  return <section data-boussole-id="directory-search" aria-labelledby="directory-search-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <h2 id="directory-search-title" className="text-2xl font-bold text-slate-950">Rechercher dans l’Annuaire</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Recherchez uniquement des acteurs ayant choisi de publier leur profil.</p>
    <div data-boussole-id="directory-natural-search" className="mt-6 rounded-2xl bg-emerald-50 p-4 sm:p-5"><label htmlFor="directory-natural-query" className="text-sm font-semibold text-slate-900">Décrivez qui vous recherchez</label><textarea id="directory-natural-query" value={naturalQuery} maxLength={500} onChange={(event) => { setNaturalQuery(event.target.value); setUnsupported([]); }} placeholder="Je cherche un expert cybersécurité parlant allemand." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-emerald-200 bg-white px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" /><button type="button" disabled={interpreting || !naturalQuery.trim()} onClick={() => void interpret()} className="mt-3 min-h-11 rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60">{interpreting ? "Interprétation…" : "Comprendre ma recherche"}</button><span className="sr-only" aria-live="polite">{interpreting ? "Interprétation de la demande en cours" : ""}</span></div>
    {interpretError ? <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{interpretError}</p> : null}
    {understood ? <div data-boussole-id="directory-interpreted-criteria" className="mt-4 rounded-2xl border border-emerald-200 p-4" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-950">Nous avons compris</h3><button type="button" onClick={() => { setForm(emptySearch); setUnsupported([]); setNaturalQuery(""); setPage(null); }} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-800 underline focus-visible:outline focus-visible:outline-2">Réinitialiser</button></div><p className="mt-2 text-sm text-slate-600">Vérifiez et corrigez ces critères dans les filtres avant de rechercher.</p><ul className="mt-3 flex flex-wrap gap-2 text-sm">{form.actorType ? <li className="rounded-full bg-slate-100 px-3 py-2">Type : {form.actorType === "PERSON" ? "Personne" : "Organisation"}</li> : null}{form.text ? <li className="rounded-full bg-slate-100 px-3 py-2">Texte : {form.text}</li> : null}{filters.flatMap(([field, label]) => splitValues(form[field]).map((value) => <li key={`${field}-${value}`} className="rounded-full bg-slate-100 px-3 py-2">{label} : {value}</li>))}{form.verifiedKinds.map((kind) => <li key={kind} className="rounded-full bg-emerald-100 px-3 py-2">{kinds.find(([value]) => value === kind)?.[1]} : vérification exigée</li>)}</ul></div> : null}
    {unsupported.length ? <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Critères non pris en charge</p><ul className="mt-2 list-disc space-y-1 pl-5">{unsupported.map((item, index) => <li key={`${item.label}-${index}`}>Ce critère n’est pas encore pris en charge : {item.label}{item.reason ? ` — ${item.reason}` : ""}</li>)}</ul></div> : null}
    <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <div className="grid gap-4 md:grid-cols-[1fr_14rem_auto] md:items-end">
        <label className="text-sm font-semibold text-slate-800">Nom, métier ou compétence<input value={form.text} minLength={2} maxLength={80} onChange={(event) => setForm({ ...form, text: event.target.value })} placeholder="Nom, métier, compétence…" className={inputClass} /></label>
        <label className="text-sm font-semibold text-slate-800">Type d’acteur<select value={form.actorType} onChange={(event) => setForm({ ...form, actorType: event.target.value })} className={inputClass}><option value="">Tous</option><option value="PERSON">Personnes</option><option value="ORGANIZATION">Organisations</option></select></label>
        <button disabled={loading} className="min-h-11 rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60">{loading ? "Recherche…" : "Rechercher"}</button>
      </div>
      <details data-boussole-id="directory-filters" open={understood || undefined} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Affiner avec des filtres</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filters.map(([field, label]) => <label key={field} className="text-sm font-semibold text-slate-700">{label}<input value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder="Valeur(s) séparée(s) par une virgule" className={inputClass} /></label>)}</div>
        <fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-700">Exiger une information vérifiée</legend><div className="mt-2 flex flex-wrap gap-3">{kinds.map(([kind, label]) => <label key={kind} className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><input type="checkbox" checked={form.verifiedKinds.includes(kind)} onChange={(event) => setForm({ ...form, verifiedKinds: event.target.checked ? [...form.verifiedKinds, kind] : form.verifiedKinds.filter((value) => value !== kind) })} />{label}</label>)}</div></fieldset>
      </details>
    </form>
    <div aria-live="polite" className="mt-6">
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {!page && !error ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Saisissez un nom ou utilisez les filtres pour commencer votre recherche.</p> : null}
      {page && !page.items.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun profil publié ne correspond actuellement à ces critères.</p> : null}
      {page?.items.length ? <div className="grid gap-4 lg:grid-cols-2">{page.items.map((profile, index) => index === 0 ? <div key={profile.publicId} data-boussole-id="directory-first-result"><DirectoryProfileCard profile={profile} /></div> : <div key={profile.publicId}><DirectoryProfileCard profile={profile} /></div>)}</div> : null}
      {page?.nextCursor ? <button disabled={loading} onClick={() => void search(page.nextCursor ?? undefined)} className="mt-5 min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 font-semibold text-slate-800 disabled:opacity-60">{loading ? "Chargement…" : "Afficher plus"}</button> : null}
    </div>
    <p className="mt-6 text-sm text-slate-600">Vous cherchez un Portfolio, un Workspace ou un dossier auquel vous avez déjà accédé ? <Link href="/recherche" className="font-semibold text-emerald-800 underline underline-offset-2">Utilisez Recherche Goodissima</Link>.</p>
  </section>;
}

function DirectoryEnrollment({ profiles }: { profiles: ManagedDirectoryProfileDto[] }) {
  const profile = profiles.find((item) => item.actorType === "PERSON");
  return <section data-boussole-id="directory-enrollment" aria-labelledby="directory-enrollment-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div data-boussole-id="directory-identity"><h2 id="directory-enrollment-title" className="text-2xl font-bold text-slate-950">Mon inscription dans l’Annuaire</h2>{profile ? <ManageEnrollment profile={profile} /> : <CreateEnrollment />}</div></section>;
}

function CreateEnrollment() {
  const [name, setName] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { const result = await actions.createDirectoryDraftAction(name); if (!result.ok) setMessage(result.error); else router.refresh(); } finally { setBusy(false); } }
  return <div className="mt-4"><p className="text-slate-700">Vous n’avez pas encore configuré votre inscription dans l’Annuaire Global.</p><details className="mt-5 max-w-xl rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold text-emerald-800">Configurer mon inscription</summary><form onSubmit={submit} className="mt-4"><label className="text-sm font-semibold text-slate-800">Nom affiché dans l’Annuaire<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></label><p className="mt-2 text-sm text-slate-600">Ce nom sera visible dans l’Annuaire Global. Il n’est pas nécessairement identique au nom de votre compte.</p>{message ? <p role="alert" className="mt-3 text-sm text-red-700">{message}</p> : null}<button disabled={busy} className="mt-4 min-h-11 rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Création…" : "Créer mon inscription"}</button></form></details></div>;
}

function ManageEnrollment({ profile }: { profile: ManagedDirectoryProfileDto }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const intro = profile.status === "DRAFT" ? "Votre inscription est en préparation." : profile.status === "PUBLISHED" ? "Vous êtes visible dans l’Annuaire Global." : "Votre inscription n’est actuellement plus visible.";
  async function act(operation: () => Promise<actions.DirectoryUiActionResult>) { setBusy(true); setMessage(""); try { const result = await operation(); if (!result.ok) setMessage(result.error); else router.refresh(); } finally { setBusy(false); } }
  return <div className="mt-4"><p className="font-medium text-slate-800">{intro}</p>
    <form onSubmit={(event) => { event.preventDefault(); void act(() => actions.updateDirectoryNameAction(profile.publicId, String(new FormData(event.currentTarget).get("publicName") ?? ""))); }} className="mt-5 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold text-slate-700">Nom public<input name="publicName" defaultValue={profile.publicName} minLength={2} maxLength={120} className={inputClass} /></label><button disabled={busy} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 disabled:opacity-60">Modifier le nom</button></form>
    <div className="mt-6"><h3 className="text-lg font-bold text-slate-950">Mes informations</h3><p className="mt-1 text-sm text-slate-600">Chaque information est publiée séparément. La vérification concerne uniquement l’attribut indiqué.</p><div className="mt-4 space-y-3">{profile.attributes.map((attribute) => <ManagedAttribute key={attribute.attributeId} profile={profile} attribute={attribute} busy={busy} act={act} />)}{!profile.attributes.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune information ajoutée.</p> : null}</div><AddAttribute profile={profile} busy={busy} act={act} /></div>
    {message ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p> : null}
    <div className="mt-7 border-t border-slate-200 pt-6">{profile.status === "DRAFT" ? <><p className="text-sm text-slate-600">Les informations marquées « Publié » deviendront visibles aux utilisateurs de l’Annuaire Goodissima.</p><button disabled={busy || !profile.canPublish} onClick={() => void act(() => actions.publishDirectoryProfileAction(profile.publicId))} className="mt-3 min-h-11 rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-60">Publier mon inscription</button></> : null}{profile.status === "PUBLISHED" ? <div className="flex flex-wrap gap-3"><Link href={`/annuaire/${encodeURIComponent(profile.publicId)}`} className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white">Voir mon profil public</Link><button disabled={busy} onClick={() => { if (window.confirm("Votre profil et vos informations publiées ne seront plus visibles dans l’Annuaire. Vous pourrez les réactiver plus tard.")) void act(() => actions.disableDirectoryProfileAction(profile.publicId)); }} className="min-h-11 rounded-xl border border-red-300 bg-white px-5 py-2 font-semibold text-red-800">Désactiver mon inscription</button></div> : null}{profile.status === "DISABLED" ? <button disabled={busy} onClick={() => void act(() => actions.republishDirectoryProfileAction(profile.publicId))} className="min-h-11 rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white">Réactiver mon inscription</button> : null}</div>
  </div>;
}

type Act = (operation: () => Promise<actions.DirectoryUiActionResult>) => Promise<void>;
function ManagedAttribute({ profile, attribute, busy, act }: { profile: ManagedDirectoryProfileDto; attribute: ManagedDirectoryAttributeDto; busy: boolean; act: Act }) {
  const fieldId = useId();
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{attribute.displayValue}</p><p className="mt-1 text-xs text-slate-600">{kinds.find(([kind]) => kind === attribute.kind)?.[1]} · {statusLabels[attribute.publicationStatus]} · {attribute.trustLevel === "VERIFIED" ? "✓ Vérifié" : "Déclaré"}</p></div>{attribute.publicationStatus === "PUBLISHED" ? <button disabled={busy} onClick={() => void act(() => actions.withdrawDirectoryAttributeAction(profile.publicId, attribute.attributeId))} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold">Retirer</button> : <button disabled={busy} onClick={() => void act(() => actions.publishDirectoryAttributeAction(profile.publicId, attribute.attributeId))} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold">{attribute.publicationStatus === "WITHDRAWN" ? "Republier" : "Publier"}</button>}</div>{attribute.trustLevel === "DECLARED" ? <form onSubmit={(event) => { event.preventDefault(); void act(() => actions.updateDirectoryAttributeAction(profile.publicId, attribute.attributeId, { displayValue: String(new FormData(event.currentTarget).get("value") ?? "") })); }} className="mt-3 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor={fieldId}>Modifier {attribute.displayValue}</label><input id={fieldId} name="value" defaultValue={attribute.displayValue} maxLength={160} className="min-h-10 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button disabled={busy} className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Modifier</button></form> : null}</article>;
}

function AddAttribute({ profile, busy, act }: { profile: ManagedDirectoryProfileDto; busy: boolean; act: Act }) {
  const [kind, setKind] = useState<Kind>("PROFESSION");
  return <details className="mt-4 rounded-xl border border-dashed border-slate-300 p-4"><summary className="cursor-pointer font-semibold text-emerald-800">Ajouter une information</summary><form className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const value = String(new FormData(form).get("value") ?? ""); void act(async () => { const result = await actions.addDirectoryAttributeAction(profile.publicId, { kind, displayValue: value, locationGranularity: kind === "LOCATION" ? "CITY" : null }); if (result.ok) form.reset(); return result; }); }}><label className="text-sm font-semibold text-slate-700">Type<select value={kind} onChange={(event) => setKind(event.target.value as Kind)} className={inputClass}>{kinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Information<input required name="value" maxLength={160} className={inputClass} /></label><button disabled={busy} className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60">Ajouter</button></form><p className="mt-2 text-xs text-slate-600">L’information est créée en brouillon et avec le niveau « Déclaré ».</p></details>;
}
