"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { validateTemplateDraftQuality } from "@/lib/ai/template-draft-quality";
import { addJourneyStage, deleteJourneyStage, manualJourneyChanges, parseEditableJourneyDesign, reorderJourneyStage, updateJourneyStage, type EditableJourneyDesign } from "@/lib/manual-journey-editor";
import type { ProposalChangeSet } from "@/lib/ai/opportunity-refinement";

type Props = {
  templateId: string;
  sourceVersion: { id: string; version: number; isPublished: boolean };
  previousVersion: number | null;
  initialDesign: EditableJourneyDesign;
  templateName: string;
  fields: Array<Record<string, unknown>>;
  lastSavedChanges?: ProposalChangeSet | null;
};

function Input({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs font-medium text-slate-600">{label}<input value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-slate-900" /></label>;
}

function StageSelect({ value, count, onChange }: { value: number; count: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-medium text-slate-600">Étape<select value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal text-slate-900">{Array.from({ length: Math.max(count, 1) }, (_, index) => <option key={index + 1} value={index + 1}>Étape {index + 1}</option>)}</select></label>;
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">{label}</button>;
}

export function ManualJourneyEditor({ templateId, sourceVersion, previousVersion, initialDesign, templateName, fields, lastSavedChanges }: Props) {
  const router = useRouter();
  const toast = useToast();
  const normalizedInitial = useMemo(() => parseEditableJourneyDesign(initialDesign), [initialDesign]);
  const [editing, setEditing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [design, setDesign] = useState(normalizedInitial);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const validation = useMemo(() => validateTemplateDraftQuality({ draft: { name: templateName, ...design, fields, isPublished: false }, requireProvenance: false, requireUnpublished: true }), [design, fields, templateName]);
  const changes = useMemo(() => manualJourneyChanges(normalizedInitial, design), [normalizedInitial, design]);
  const hasChanges = changes.added.length + changes.modified.length + changes.removed.length > 0;

  function cancel() {
    setDesign(normalizedInitial);
    setReason("");
    setReordering(false);
    setEditing(false);
  }

  async function save() {
    if (!hasChanges || !validation.valid || sourceVersion.isPublished) return;
    setSaving(true);
    const response = await fetch(`/api/templates/${templateId}/manual-versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceVersionId: sourceVersion.id, design, reason }) });
    setSaving(false);
    if (!response.ok) {
      try { const body = await response.json(); toast.error(typeof body.error === "string" ? body.error : "Enregistrement impossible"); } catch { toast.error("Enregistrement impossible"); }
      return;
    }
    const body = await response.json();
    toast.success(`Nouvelle version DRAFT v${body.templateVersion.version} enregistrée. Aucune publication effectuée.`);
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-2xl border border-violet-200 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Édition manuelle</p><h2 className="mt-1 text-lg font-semibold">Builder du parcours</h2><p className="mt-1 max-w-3xl text-sm text-slate-500">Vous pouvez adapter le parcours à votre réalité terrain. Goodissima conserve l’historique et contrôle la qualité avant validation.</p></div>
        {!editing ? <button type="button" onClick={() => setEditing(true)} disabled={sourceVersion.isPublished} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Modifier le parcours</button> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-900">Version actuelle : v{sourceVersion.version}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Version précédente : {previousVersion ? `v${previousVersion}` : "aucune"}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">Non publiée</span></div>
      {!editing && lastSavedChanges ? <div className="mt-4"><ChangeSummary changes={lastSavedChanges} /></div> : null}
      {sourceVersion.isPublished ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Cette version est publiée et protégée. Sélectionnez ou créez une version DRAFT non publiée avant toute modification.</p> : null}

      {editing ? <div className="mt-6 space-y-6">
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDesign(addJourneyStage(design))} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Ajouter une étape</button><button type="button" onClick={() => setReordering((value) => !value)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">Réordonner les étapes</button></div>

        <EditorSection title="Étapes">
          {design.stages.map((stage, index) => <div key={`stage-${index}`} className="rounded-xl border p-4"><div className="grid gap-3 md:grid-cols-2"><Input label="Titre" value={stage.name} onChange={(value) => setDesign(updateJourneyStage(design, index, { name: value }))} /><Input label="Description / objectif" value={stage.objective} onChange={(value) => setDesign(updateJourneyStage(design, index, { objective: value }))} /><Input label="Acteur responsable" value={stage.responsibleActor} onChange={(value) => setDesign(updateJourneyStage(design, index, { responsibleActor: value || undefined }))} /><Input label="Action attendue" value={stage.expectedAction} onChange={(value) => setDesign(updateJourneyStage(design, index, { expectedAction: value || undefined }))} /><Input label="Condition de sortie" value={stage.exitCondition} onChange={(value) => setDesign(updateJourneyStage(design, index, { exitCondition: value || undefined }))} /><Input label="Délai indicatif" value={stage.deadline} onChange={(value) => setDesign(updateJourneyStage(design, index, { deadline: value || undefined }))} /></div><div className="mt-3 flex flex-wrap gap-2">{reordering ? <><button type="button" disabled={index === 0} onClick={() => setDesign(reorderJourneyStage(design, index, index - 1))} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-30">Monter</button><button type="button" disabled={index === design.stages.length - 1} onClick={() => setDesign(reorderJourneyStage(design, index, index + 1))} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-30">Descendre</button></> : null}<RemoveButton label="Supprimer l’étape" onClick={() => setDesign(deleteJourneyStage(design, index))} /></div></div>)}
        </EditorSection>

        <EditorSection title="Acteurs">
          {design.actors.map((actor, index) => <div key={`actor-${index}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_2fr_auto]"><Input label="Nom" value={actor.name} onChange={(value) => setDesign({ ...design, actors: design.actors.map((item, position) => position === index ? { ...item, name: value } : item) })} /><Input label="Rôle" value={actor.role} onChange={(value) => setDesign({ ...design, actors: design.actors.map((item, position) => position === index ? { ...item, role: value } : item) })} /><div className="self-end"><RemoveButton label="Supprimer" onClick={() => setDesign({ ...design, actors: design.actors.filter((_, position) => position !== index) })} /></div></div>)}
          <button type="button" onClick={() => setDesign({ ...design, actors: [...design.actors, { name: "Nouvel acteur", role: "Rôle à préciser" }] })} className="rounded-xl border px-4 py-2 text-sm font-semibold">Ajouter un acteur</button>
        </EditorSection>

        <EditorSection title="Documents requis">
          {design.documents.map((document, index) => <div key={`document-${index}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[2fr_1fr_1fr_auto]"><Input label="Document" value={document.name} onChange={(value) => setDesign({ ...design, documents: design.documents.map((item, position) => position === index ? { ...item, name: value } : item) })} /><StageSelect value={document.stage} count={design.stages.length} onChange={(value) => setDesign({ ...design, documents: design.documents.map((item, position) => position === index ? { ...item, stage: value } : item) })} /><label className="self-end rounded-lg border px-3 py-2 text-sm"><input type="checkbox" checked={document.required} onChange={(event) => setDesign({ ...design, documents: design.documents.map((item, position) => position === index ? { ...item, required: event.target.checked } : item) })} className="mr-2" />Requis</label><div className="self-end"><RemoveButton label="Supprimer" onClick={() => setDesign({ ...design, documents: design.documents.filter((_, position) => position !== index) })} /></div></div>)}
          <button type="button" onClick={() => setDesign({ ...design, documents: [...design.documents, { name: "Nouveau document", required: true, stage: 1 }] })} className="rounded-xl border px-4 py-2 text-sm font-semibold">Ajouter un document</button>
        </EditorSection>

        <EditorSection title="Demandes relationnelles">
          {design.relationalRequests.map((request, index) => <div key={`request-${index}`} className="rounded-xl border p-4"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><Input label="Titre" value={request.title} onChange={(value) => setDesign({ ...design, relationalRequests: design.relationalRequests.map((item, position) => position === index ? { ...item, title: value } : item) })} /><Input label="Description" value={request.description} onChange={(value) => setDesign({ ...design, relationalRequests: design.relationalRequests.map((item, position) => position === index ? { ...item, description: value } : item) })} /><StageSelect value={request.stage} count={design.stages.length} onChange={(value) => setDesign({ ...design, relationalRequests: design.relationalRequests.map((item, position) => position === index ? { ...item, stage: value } : item) })} /><Input label="Acteur cible" value={request.targetActor} onChange={(value) => setDesign({ ...design, relationalRequests: design.relationalRequests.map((item, position) => position === index ? { ...item, targetActor: value || undefined } : item) })} /><Input label="Délai" value={request.deadline} onChange={(value) => setDesign({ ...design, relationalRequests: design.relationalRequests.map((item, position) => position === index ? { ...item, deadline: value || undefined } : item) })} /></div><div className="mt-3"><RemoveButton label="Supprimer la demande" onClick={() => setDesign({ ...design, relationalRequests: design.relationalRequests.filter((_, position) => position !== index) })} /></div></div>)}
          <button type="button" onClick={() => setDesign({ ...design, relationalRequests: [...design.relationalRequests, { title: "Nouvelle demande", description: "Action humaine attendue", stage: 1 }] })} className="rounded-xl border px-4 py-2 text-sm font-semibold">Ajouter une demande relationnelle</button>
        </EditorSection>

        <EditorSection title="KPI">
          {design.kpis.map((kpi, index) => <div key={`kpi-${index}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_2fr_1fr_auto]"><Input label="Nom" value={kpi.name} onChange={(value) => setDesign({ ...design, kpis: design.kpis.map((item, position) => position === index ? { ...item, name: value } : item) })} /><Input label="Description" value={kpi.description} onChange={(value) => setDesign({ ...design, kpis: design.kpis.map((item, position) => position === index ? { ...item, description: value } : item) })} /><Input label="Unité" value={kpi.unit} onChange={(value) => setDesign({ ...design, kpis: design.kpis.map((item, position) => position === index ? { ...item, unit: value } : item) })} /><div className="self-end"><RemoveButton label="Supprimer" onClick={() => setDesign({ ...design, kpis: design.kpis.filter((_, position) => position !== index) })} /></div></div>)}
          <button type="button" onClick={() => setDesign({ ...design, kpis: [...design.kpis, { name: "Nouvel indicateur", description: "Mesure à suivre", unit: "%" }] })} className="rounded-xl border px-4 py-2 text-sm font-semibold">Ajouter un KPI</button>
        </EditorSection>

        <div className="grid gap-4 lg:grid-cols-2"><QualityGuard validation={validation} /><ChangeSummary changes={changes} /></div>
        <label className="block text-sm font-semibold">Raison ou commentaire (facultatif)<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border px-4 py-3 font-normal" placeholder="Expliquez pourquoi cette nouvelle version est nécessaire." /></label>
        <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">L’enregistrement crée une nouvelle version DRAFT. Il ne publie rien, n’exécute aucun workflow, ne contacte aucun participant et ne modifie aucune relation active.</div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void save()} disabled={saving || !hasChanges || !validation.valid} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Enregistrement..." : "Enregistrer une nouvelle version"}</button><button type="button" onClick={cancel} disabled={saving} className="rounded-xl border px-4 py-2 text-sm font-semibold">Annuler</button></div>
      </div> : null}
    </section>
  );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) { return <div><h3 className="mb-3 font-semibold">{title}</h3><div className="space-y-3">{children}</div></div>; }
function QualityGuard({ validation }: { validation: ReturnType<typeof validateTemplateDraftQuality> }) { return <div className="rounded-xl border p-4"><h3 className="font-semibold">Quality Guard</h3>{validation.errors.length === 0 ? <p className="mt-2 text-sm text-emerald-700">Aucune erreur critique. L’enregistrement est autorisé.</p> : <ul className="mt-2 space-y-1 text-sm text-red-700">{validation.errors.map((issue, index) => <li key={`${issue.code}-${index}`}>Erreur critique : {issue.message}</li>)}</ul>}{validation.warnings.length > 0 ? <ul className="mt-3 space-y-1 text-sm text-amber-700">{validation.warnings.map((issue, index) => <li key={`${issue.code}-${index}`}>Avertissement : {issue.message}</li>)}</ul> : null}</div>; }
function ChangeSummary({ changes }: { changes: ReturnType<typeof manualJourneyChanges> }) { return <div className="rounded-xl border p-4"><h3 className="font-semibold">Résumé des changements</h3><p className="mt-2 text-sm text-emerald-700">Ajouté : {changes.added.join(", ") || "rien"}</p><p className="mt-1 text-sm text-blue-700">Modifié : {changes.modified.join(", ") || "rien"}</p><p className="mt-1 text-sm text-red-700">Supprimé : {changes.removed.join(", ") || "rien"}</p></div>; }
