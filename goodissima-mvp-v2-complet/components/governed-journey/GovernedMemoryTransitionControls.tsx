"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { disputeJourneyFactAction, establishJourneyFactAction, validateJourneyDecisionAction } from "@/lib/governed-memory/cockpit-transition-actions";
import { initialGovernedMemoryTransitionActionState, type GovernedMemoryTransitionActionState } from "@/lib/governed-memory/cockpit-transition-action-state";

type Action = "ESTABLISH_FACT" | "DISPUTE_FACT" | "VALIDATE_DECISION";
type Props = { formTemplateId: string; publicMemoryKey: string; concurrencyToken: string | null; content: string; capabilities: { canEstablish: boolean; canDispute: boolean; canValidate: boolean }; requestKeys: Record<Action, string> };
const labels = { ESTABLISH_FACT: "Établir ce fait", DISPUTE_FACT: "Contester ce fait", VALIDATE_DECISION: "Valider la décision" } as const;
const descriptions = {
  ESTABLISH_FACT: "Cette action confirme que ce fait est retenu comme établi dans la mémoire gouvernée. Elle sera historisée.",
  DISPUTE_FACT: "La contestation sera enregistrée et historisée. Elle ne supprime pas le fait et ne modifie pas automatiquement son statut.",
  VALIDATE_DECISION: "Cette action approuve la décision et la fait passer de brouillon à validée. Elle sera historisée.",
} as const;

function Submit({ action }: { action: Action }) { const { pending } = useFormStatus(); const pendingLabel = action === "ESTABLISH_FACT" ? "Établissement…" : action === "DISPUTE_FACT" ? "Ouverture…" : "Validation…"; const label = action === "ESTABLISH_FACT" ? "Établir le fait" : action === "DISPUTE_FACT" ? "Ouvrir la contestation" : "Valider la décision"; return <button type="submit" disabled={pending} aria-disabled={pending} className="rounded-lg bg-[#247f88] px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending ? pendingLabel : label}</button>; }
function Feedback({ state }: { state: GovernedMemoryTransitionActionState }) { return state.status === "IDLE" ? null : <p role={state.status === "ERROR" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${state.status === "ERROR" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{state.message}</p>; }

export function GovernedMemoryTransitionControls(props: Props) {
  const [open, setOpen] = useState<Action | null>(null); const [dirty, setDirty] = useState(false); const trigger = useRef<HTMLButtonElement | null>(null); const firstField = useRef<HTMLTextAreaElement | null>(null);
  const [establishState, establishAction] = useFormState(establishJourneyFactAction, initialGovernedMemoryTransitionActionState);
  const [disputeState, disputeAction] = useFormState(disputeJourneyFactAction, initialGovernedMemoryTransitionActionState);
  const [validateState, validateAction] = useFormState(validateJourneyDecisionAction, initialGovernedMemoryTransitionActionState);
  const state = open === "ESTABLISH_FACT" ? establishState : open === "DISPUTE_FACT" ? disputeState : validateState;
  useEffect(() => { if (open) firstField.current?.focus(); }, [open]);
  useEffect(() => { if (state.status === "SUCCESS") { setOpen(null); setDirty(false); trigger.current?.focus(); } }, [state.status]);
  const close = () => { if (dirty && !window.confirm("Fermer ce formulaire et perdre la saisie en cours ?")) return; setOpen(null); setDirty(false); trigger.current?.focus(); };
  const available: Action[] = [...(props.capabilities.canEstablish ? ["ESTABLISH_FACT" as const] : []), ...(props.capabilities.canDispute ? ["DISPUTE_FACT" as const] : []), ...(props.capabilities.canValidate ? ["VALIDATE_DECISION" as const] : [])];
  if (!available.length) return null;
  const formAction = open === "ESTABLISH_FACT" ? establishAction : open === "DISPUTE_FACT" ? disputeAction : validateAction;
  return <div className="mt-4 border-t border-slate-200 pt-4">
    <div className="flex flex-wrap gap-2">{available.map((action) => <button key={action} ref={open === action ? trigger : undefined} type="button" onClick={(event) => { trigger.current = event.currentTarget; setOpen(action); }} className="rounded-lg border border-[#247f88] px-3 py-2 text-sm font-bold text-[#17626a]">{labels[action]}</button>)}</div>
    {open ? <div role="dialog" aria-modal="false" aria-labelledby={`memory-transition-${props.publicMemoryKey}`} className="mt-3 rounded-lg border border-cyan-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3"><div><h4 id={`memory-transition-${props.publicMemoryKey}`} className="font-bold text-slate-950">{labels[open]}</h4><p id={`memory-transition-help-${props.publicMemoryKey}`} className="mt-1 text-sm text-slate-600">{descriptions[open]}</p></div><button type="button" onClick={close} className="rounded-lg border px-3 py-2 text-sm font-semibold" aria-label="Fermer la confirmation">Fermer</button></div>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Élément concerné :</span> {props.content}</p>
      <form action={formAction} className="mt-4 grid gap-3" key={props.requestKeys[open]} onChange={() => setDirty(true)}>
        <input type="hidden" name="formTemplateId" value={props.formTemplateId} /><input type="hidden" name="publicMemoryKey" value={props.publicMemoryKey} /><input type="hidden" name="requestKey" value={props.requestKeys[open]} />
        {open !== "DISPUTE_FACT" ? <input type="hidden" name="concurrencyToken" value={props.concurrencyToken ?? ""} /> : null}
        <label className="text-sm font-semibold text-slate-800" htmlFor={`memory-transition-field-${props.publicMemoryKey}`}>{open === "DISPUTE_FACT" ? "Motif de la contestation" : "Justification"}</label>
        <textarea ref={firstField} id={`memory-transition-field-${props.publicMemoryKey}`} name={open === "DISPUTE_FACT" ? "reason" : "justification"} required maxLength={4000} rows={3} aria-describedby={`memory-transition-help-${props.publicMemoryKey} memory-transition-error-${props.publicMemoryKey}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        {state.status === "ERROR" && state.fieldErrors ? <p id={`memory-transition-error-${props.publicMemoryKey}`} className="text-sm text-red-700">{state.fieldErrors.reason ?? state.fieldErrors.justification}</p> : <span id={`memory-transition-error-${props.publicMemoryKey}`} />}
        <Feedback state={state} /><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={close} className="rounded-lg border px-4 py-2 text-sm font-semibold">Annuler</button><Submit action={open} /></div>
      </form>
    </div> : null}
  </div>;
}
