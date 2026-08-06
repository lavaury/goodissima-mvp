"use client";

import { useFormState, useFormStatus } from "react-dom";
import { initialGovernedMemoryTransitionActionState, renounceJourneyMemoryStewardRoleAction, revokeJourneyMemoryRoleAction, takeJourneyMemoryStewardRoleAction, type GovernedMemoryTransitionActionState } from "@/lib/governed-memory/cockpit-transition-actions";

type Role = { beneficiaryKey: string; displayName: string; roleLabel: string; requestKey: string; isOrganizerSteward: boolean };
type Props = { formTemplateId: string; roles: Role[]; takeRequestKey: string; renounceRequestKey: string };

function SubmitButton({ pendingLabel, label, danger = false }: { pendingLabel: string; label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending} className={`rounded-lg px-3 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-60 ${danger ? "border border-red-300 text-red-800" : "bg-[#247f88] text-white"}`}>{pending ? pendingLabel : label}</button>;
}

function Feedback({ state }: { state: GovernedMemoryTransitionActionState }) {
  return state.status === "IDLE" ? null : <p role={state.status === "ERROR" ? "alert" : "status"} className={`mt-3 rounded-lg p-3 text-sm ${state.status === "ERROR" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{state.message}</p>;
}

function TakeRole({ formTemplateId, requestKey }: { formTemplateId: string; requestKey: string }) {
  const [state, action] = useFormState(takeJourneyMemoryStewardRoleAction, initialGovernedMemoryTransitionActionState);
  return <details className="mt-4 rounded-lg border border-cyan-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-[#17626a]">Prendre la fonction</summary><div className="mt-3"><h3 className="font-bold text-slate-950">Prendre la fonction de responsable de la mémoire</h3><p className="mt-2 text-sm text-slate-700">Vous pourrez établir les faits, ouvrir des contestations et valider les décisions de ce parcours. Cette prise de fonction sera enregistrée.</p><form action={action} className="mt-3"><input type="hidden" name="formTemplateId" value={formTemplateId} /><input type="hidden" name="requestKey" value={requestKey} /><SubmitButton label="Prendre la fonction" pendingLabel="Prise de fonction…" /></form><Feedback state={state} /></div></details>;
}

function RoleCard({ formTemplateId, role, renounceRequestKey }: { formTemplateId: string; role: Role; renounceRequestKey: string }) {
  const action = role.isOrganizerSteward ? renounceJourneyMemoryStewardRoleAction : revokeJourneyMemoryRoleAction;
  const [state, formAction] = useFormState(action, initialGovernedMemoryTransitionActionState);
  return <li className="rounded-lg border border-slate-200 bg-white p-4"><p className="font-bold text-slate-950">{role.displayName}</p><p className="mt-1 text-sm text-slate-600">{role.roleLabel} · En fonction</p><details className="mt-3"><summary className="cursor-pointer text-sm font-bold text-red-800">{role.isOrganizerSteward ? "Renoncer à la fonction" : "Révoquer cette fonction"}</summary><div className="mt-3 rounded-lg bg-red-50 p-3"><p className="text-sm text-red-950">{role.isOrganizerSteward ? "Vous ne pourrez plus effectuer de nouvelles qualifications de mémoire. Les actions déjà réalisées resteront conservées." : "La révocation empêchera cette personne d’effectuer de nouvelles qualifications de mémoire pour ce parcours. Les actions historiques déjà réalisées resteront conservées."}</p><form action={formAction} className="mt-3"><input type="hidden" name="formTemplateId" value={formTemplateId} /><input type="hidden" name="requestKey" value={role.isOrganizerSteward ? renounceRequestKey : role.requestKey} />{role.isOrganizerSteward ? <input type="hidden" name="renounceOwnRole" value="true" /> : <input type="hidden" name="beneficiaryKey" value={role.beneficiaryKey} />}<SubmitButton danger label={role.isOrganizerSteward ? "Renoncer à la fonction" : "Révoquer la fonction"} pendingLabel={role.isOrganizerSteward ? "Renoncement…" : "Révocation…"} /></form><Feedback state={state} /></div></details></li>;
}

export function GovernedMemoryRolesPanel({ formTemplateId, roles, takeRequestKey, renounceRequestKey }: Props) {
  const organizerIsSteward = roles.some((role) => role.isOrganizerSteward);
  return <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50/40 p-5"><h2 className="text-lg font-bold text-slate-950">Responsable de la mémoire</h2><p className="mt-2 text-sm text-slate-700">Le responsable de la mémoire peut établir les faits, ouvrir des contestations et valider les décisions de ce parcours.</p><p className="mt-2 text-xs text-slate-600">Dans cette version, l’organisateur peut prendre cette fonction directement. La désignation collective sera ajoutée ultérieurement.</p>{roles.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{roles.map((role) => <RoleCard key={role.beneficiaryKey} formTemplateId={formTemplateId} role={role} renounceRequestKey={renounceRequestKey} />)}</ul> : <p className="mt-4 text-sm text-slate-600">Aucun responsable de la mémoire n’est actuellement en fonction.</p>}{!organizerIsSteward ? <TakeRole formTemplateId={formTemplateId} requestKey={takeRequestKey} /> : null}</section>;
}
