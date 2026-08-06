"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { GovernedMemoryCreationCapabilities } from "@/lib/governed-journey/cockpit/memory-creation-capabilities";
import {
  retainJourneyDecisionAction,
  retainJourneyFactAction,
  retainJourneySourceAction,
} from "@/lib/governed-memory/cockpit-creation-actions";
import { initialGovernedMemoryCreationActionState } from "@/lib/governed-memory/cockpit-creation-action-service";
import type { GovernedMemoryCreationActionState } from "@/lib/governed-memory/cockpit-creation-action-service";

type Category = "fact" | "decision" | "source";
type Props = {
  formTemplateId: string;
  capabilities: GovernedMemoryCreationCapabilities;
  requestKeys: Record<Category, string>;
  today: string;
};

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950";
const labelClass = "block text-sm font-semibold text-slate-800";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-[#247f88] px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Enregistrement…" : label}</button>;
}

function Feedback({ state }: { state: GovernedMemoryCreationActionState }) {
  if (state.status === "IDLE") return null;
  return <p role={state.status === "ERROR" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${state.status === "ERROR" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{state.message}</p>;
}

function CommonFields({ formTemplateId, requestKey }: { formTemplateId: string; requestKey: string }) {
  return <><input type="hidden" name="formTemplateId" value={formTemplateId} /><input type="hidden" name="requestKey" value={requestKey} /></>;
}

export function GovernedMemoryCreationPanel({ formTemplateId, capabilities, requestKeys, today }: Props) {
  const first = capabilities.categories.fact ? "fact" : capabilities.categories.decision ? "decision" : "source";
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>(first);
  const [factState, factAction] = useFormState(retainJourneyFactAction, initialGovernedMemoryCreationActionState);
  const [decisionState, decisionAction] = useFormState(retainJourneyDecisionAction, initialGovernedMemoryCreationActionState);
  const [sourceState, sourceAction] = useFormState(retainJourneySourceAction, initialGovernedMemoryCreationActionState);
  const panelRef = useRef<HTMLDivElement>(null);
  const state = category === "fact" ? factState : category === "decision" ? decisionState : sourceState;
  const latestSuccess = [factState, decisionState, sourceState].find((item) => item.status === "SUCCESS");

  useEffect(() => {
    if (state.status === "SUCCESS") setOpen(false);
  }, [state.status]);

  if (!capabilities.canCreateAny) return null;
  return <div className="mt-5 border-t border-slate-200 pt-5">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="rounded-lg bg-[#247f88] px-4 py-2 text-sm font-bold text-white">
      Retenir dans la mémoire
    </button>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">L’enregistrement reste une action humaine explicite. Il ne vaut ni validation, ni vérité établie, ni décision validée.</p>
    {!open && latestSuccess ? <Feedback state={latestSuccess} /> : null}
    {open ? <div ref={panelRef} className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50/40 p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Type d’élément à retenir">
        {capabilities.categories.fact ? <button type="button" onClick={() => setCategory("fact")} aria-pressed={category === "fact"} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${category === "fact" ? "border-[#247f88] bg-white text-[#17626a]" : "border-slate-300 text-slate-700"}`}>Fait</button> : null}
        {capabilities.categories.decision ? <button type="button" onClick={() => setCategory("decision")} aria-pressed={category === "decision"} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${category === "decision" ? "border-[#247f88] bg-white text-[#17626a]" : "border-slate-300 text-slate-700"}`}>Décision</button> : null}
      {capabilities.categories.source ? <button type="button" onClick={() => setCategory("source")} aria-pressed={category === "source"} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${category === "source" ? "border-[#247f88] bg-white text-[#17626a]" : "border-slate-300 text-slate-700"}`}>Source déterminante</button> : null}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">Retenir dans la mémoire</h3><p className="mt-1 text-sm text-slate-700">Choisissez l’élément durable que vous souhaitez conserver pour la suite du parcours.</p><p className="mt-1 text-xs text-slate-600">L’enregistrement est effectué uniquement après votre confirmation.</p></div><button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" aria-label="Fermer le formulaire">Fermer</button></div>
      <p className="mt-3 text-xs text-slate-600">Portée : ensemble du parcours. Aucun dossier particulier n’est sélectionné.</p>
      {category === "fact" ? <form action={factAction} className="mt-4 grid gap-4" key={requestKeys.fact}>
        <CommonFields formTemplateId={formTemplateId} requestKey={requestKeys.fact} />
        <h4 className="font-bold text-slate-950">Retenir un fait</h4><p className="text-sm text-slate-600">Décrivez une information factuelle utile pour la suite du parcours.</p>
        <label className={labelClass}>Fait à retenir<textarea name="statement" required maxLength={4000} rows={4} className={inputClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Niveau de preuve<select name="evidenceLevel" defaultValue="DECLARED" className={inputClass}><option value="DECLARED">Déclaré</option><option value="SUPPORTED">Étayé</option><option value="CORROBORATED">Corroboré</option><option value="CONTESTED">Contesté</option></select></label><label className={labelClass}>Applicable à partir du<input type="date" name="effectiveFrom" required defaultValue={today} className={inputClass} /></label></div>
        <label className={labelClass}>Applicable jusqu’au (facultatif)<input type="date" name="effectiveUntil" className={inputClass} /></label>
        <label className={labelClass}>Provenance déclarée (facultatif)<input name="provenance" maxLength={500} className={inputClass} /></label>
        <Feedback state={factState} /><p className="text-xs text-slate-600">Cet élément sera enregistré comme proposition de fait.</p><div className="flex justify-end"><SubmitButton label="Retenir ce fait" /></div>
      </form> : null}
      {category === "decision" ? <form action={decisionAction} className="mt-4 grid gap-4" key={requestKeys.decision}>
        <CommonFields formTemplateId={formTemplateId} requestKey={requestKeys.decision} /><h4 className="font-bold text-slate-950">Consigner une décision</h4><p className="text-sm text-slate-600">Enregistrez une décision à préparer ou à formaliser pour le parcours.</p>
        <label className={labelClass}>Titre<input name="title" required maxLength={300} className={inputClass} /></label>
        <label className={labelClass}>Motifs<textarea name="rationale" required maxLength={4000} rows={4} className={inputClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Décidée le<input type="date" name="decidedAt" required defaultValue={today} className={inputClass} /></label><label className={labelClass}>Applicable à partir du<input type="date" name="effectiveFrom" required defaultValue={today} className={inputClass} /></label></div>
        <label className={labelClass}>Applicable jusqu’au (facultatif)<input type="date" name="effectiveUntil" className={inputClass} /></label>
        <label className={labelClass}>Conséquences (facultatif)<textarea name="consequences" maxLength={4000} rows={2} className={inputClass} /></label>
        <label className={labelClass}>Réserves (facultatif)<textarea name="reservations" maxLength={4000} rows={2} className={inputClass} /></label>
        <label className={labelClass}>Provenance déclarée (facultatif)<input name="provenance" maxLength={500} className={inputClass} /></label>
        <Feedback state={decisionState} /><p className="text-xs text-slate-600">Cette décision sera enregistrée comme brouillon, sans validation automatique.</p><div className="flex justify-end"><SubmitButton label="Consigner la décision" /></div>
      </form> : null}
      {category === "source" ? <form action={sourceAction} className="mt-4 grid gap-4" key={requestKeys.source}>
        <CommonFields formTemplateId={formTemplateId} requestKey={requestKeys.source} /><h4 className="font-bold text-slate-950">Référencer une source déterminante</h4><p className="text-sm text-slate-600">Conservez la référence d’un document ou d’une ressource importante pour la suite du parcours.</p>
        <label className={labelClass}>Nature de la source<select name="kind" defaultValue="HUMAN_DECLARATION" className={inputClass}><option value="HUMAN_DECLARATION">Référence déclarée</option><option value="DOCUMENT">Document</option><option value="DOCUMENT_VERSION">Version de document</option><option value="FORM_SUBMISSION">Réponse à un formulaire</option><option value="SYSTEM_EVENT">Événement système identifié</option><option value="EXTERNAL_IMPORT">Ressource externe</option></select></label>
        <label className={labelClass}>Titre<input name="title" required maxLength={300} className={inputClass} /></label>
        <label className={labelClass}>Référence ou URL<input name="sourceObjectId" required maxLength={2000} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Pour une ressource externe, indiquez une URL HTTP(S).</span></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Datée du (facultatif)<input type="date" name="authoredAt" className={inputClass} /></label><label className={labelClass}>Reçue le (facultatif)<input type="date" name="receivedAt" className={inputClass} /></label></div>
        <label className={labelClass}>Règle de visibilité (facultatif)<input name="visibilityPolicyRef" maxLength={1000} className={inputClass} /></label>
        <label className={labelClass}>Provenance déclarée (facultatif)<input name="provenance" maxLength={500} className={inputClass} /></label>
        <Feedback state={sourceState} /><p className="text-xs text-slate-600">Cette source sera enregistrée comme active.</p><div className="flex justify-end"><SubmitButton label="Référencer la source" /></div>
      </form> : null}
    </div> : null}
  </div>;
}
