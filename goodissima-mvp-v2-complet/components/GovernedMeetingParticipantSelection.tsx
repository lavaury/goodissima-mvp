"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createJourneyMemberSelectionAction,
  returnJourneyMemberSelectionToDraftAction,
  reviewJourneyMemberSelectionAction,
  validateJourneyMemberSelectionAction,
} from "@/lib/governed-meeting-participant-selection-actions";

type SelectionItem = {
  id: string;
  snapshotDisplayName: string;
  observedEligibility: "ELIGIBLE" | "ALREADY_PRESENT" | "PENDING_CONSENT" | "DECLINED" | "REVOKED" | "EXPIRED" | "INELIGIBLE";
  decision: "UNDECIDED" | "INCLUDED" | "EXCLUDED";
  decisionReason: string | null;
};

type Selection = {
  id: string;
  status: "DRAFT" | "UNDER_REVIEW" | "VALIDATED" | "MATERIALIZED" | "FAILED" | "CANCELLED";
  version: number;
  items: SelectionItem[];
  materializationSummary: { retained?: number; added?: number; alreadyPresent?: number; errors?: number } | null;
};

const eligibilityLabels: Record<SelectionItem["observedEligibility"], string> = {
  ELIGIBLE: "Éligible",
  ALREADY_PRESENT: "Déjà présent",
  PENDING_CONSENT: "Consentement en attente",
  DECLINED: "Participation au parcours déclinée",
  REVOKED: "Accès au parcours révoqué",
  EXPIRED: "Invitation expirée",
  INELIGIBLE: "Non éligible",
};

const PAGE_SIZE = 10;

function selectable(item: SelectionItem) {
  return item.observedEligibility === "ELIGIBLE" || item.observedEligibility === "ALREADY_PRESENT";
}

export function GovernedMeetingParticipantSelection({
  formTemplateId,
  communicationSessionId,
  candidateCount,
  selection,
}: {
  formTemplateId: string;
  communicationSessionId: string;
  candidateCount: number;
  selection: Selection | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [changedParticipants, setChangedParticipants] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set(selection?.items.filter((item) => item.decision === "INCLUDED").map((item) => item.id) ?? []));
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries(selection?.items.filter((item) => item.decisionReason).map((item) => [item.id, item.decisionReason!]) ?? []));
  const items = selection?.items ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return needle ? items.filter((item) => item.snapshotDisplayName.toLocaleLowerCase("fr").includes(needle)) : items;
  }, [items, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(Math.min(page, pageCount - 1) * PAGE_SIZE, (Math.min(page, pageCount - 1) + 1) * PAGE_SIZE);
  const retained = items.filter((item) => selectedIds.has(item.id));
  const excluded = items.length - retained.length;
  const alreadyPresent = retained.filter((item) => item.observedEligibility === "ALREADY_PRESENT").length;
  const toAdd = retained.filter((item) => item.observedEligibility === "ELIGIBLE").length;
  const boussoleState = !selection || items.length === 0 ? "EMPTY" : selection.status === "UNDER_REVIEW" ? "FOCUSED" : "POPULATED";

  function run(operation: () => Promise<Awaited<ReturnType<typeof createJourneyMemberSelectionAction>>>) {
    setMessage("");
    setChangedParticipants([]);
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        setMessage(result.error);
        setChangedParticipants(result.changedParticipants ?? []);
      } else if (result.kind === "MATERIALIZED") {
        setMessage(`${result.summary.retained} personnes retenues · ${result.summary.added} ajoutées à la réunion · ${result.summary.alreadyPresent} déjà présentes · ${result.summary.errors} erreur`);
      }
      router.refresh();
    });
  }

  function selectAllEligible() {
    setSelectedIds(new Set(items.filter((item) => item.observedEligibility === "ELIGIBLE").map((item) => item.id)));
  }

  function selectionInput() {
    return {
      formTemplateId,
      communicationSessionId,
      selectionId: selection?.id,
      version: selection?.version,
      selectedItemIds: [...selectedIds],
      exclusionReasons: reasons,
    };
  }

  return (
    <section data-boussole-id="governed-meeting-participant-selection" data-boussole-state={boussoleState} className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-cyan-950">Ajouter une sélection</p>
          <p className="mt-1 text-xs text-cyan-900">Source V1 : Membres du Parcours</p>
        </div>
        {(!selection || selection.status === "MATERIALIZED" || selection.status === "CANCELLED" || selection.status === "FAILED") ? (
          <button type="button" disabled={pending || candidateCount > 100} onClick={() => run(() => createJourneyMemberSelectionAction({ formTemplateId, communicationSessionId }))} className="min-h-11 rounded-lg bg-cyan-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            Membres du Parcours
          </button>
        ) : null}
      </div>

      {candidateCount > 100 ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-950">Cette sélection dépasse la limite actuelle de 100 personnes.</p> : null}
      {!selection && candidateCount <= 100 ? <p className="mt-3 text-sm text-cyan-950">{candidateCount ? `${candidateCount} membre${candidateCount > 1 ? "s" : ""} observé${candidateCount > 1 ? "s" : ""}. Créez le snapshot avant de choisir les personnes.` : "Aucun membre du parcours n’est actuellement disponible."}</p> : null}

      {selection?.status === "MATERIALIZED" ? (() => {
        const summary = selection.materializationSummary ?? {};
        return <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-950"><p className="font-bold">Sélection matérialisée</p><p className="mt-1">{summary.retained ?? 0} personnes retenues</p><p>{summary.added ?? 0} ajoutées à la réunion</p><p>{summary.alreadyPresent ?? 0} déjà présentes</p><p>{summary.errors ?? 0} erreur</p></div>;
      })() : null}

      {selection && (selection.status === "DRAFT" || selection.status === "UNDER_REVIEW") ? (
        <div className="mt-4 border-t border-cyan-200 pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={selectAllEligible} className="min-h-11 rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-950">Sélectionner tous les membres éligibles</button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Tout désélectionner</button>
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-700">Rechercher dans la sélection<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="mt-1 block min-h-11 w-full rounded-lg border bg-white px-3 py-2 font-normal" placeholder="Nom de la personne" /></label>
          <p className="mt-3 text-sm font-semibold text-cyan-950">{selectedIds.size} personne{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}</p>
          <ul className="mt-2 divide-y rounded-lg border bg-white">
            {visible.map((item) => {
              const canSelect = selectable(item);
              const checked = selectedIds.has(item.id);
              return <li key={item.id} className="p-3"><label className="flex items-start gap-3"><input type="checkbox" checked={checked} disabled={!canSelect || pending} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })} className="mt-1 size-4" /><span><strong className="block text-sm text-slate-950">{item.snapshotDisplayName}</strong><span className="text-xs text-slate-600">{eligibilityLabels[item.observedEligibility]}</span></span></label>{selection.status === "UNDER_REVIEW" && !checked ? <label className="mt-2 block pl-7 text-xs text-slate-600">Motif facultatif<input value={reasons[item.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={500} className="mt-1 block min-h-10 w-full rounded border px-2 py-1" /></label> : null}</li>;
            })}
          </ul>
          {filtered.length === 0 ? <p className="mt-2 text-sm text-slate-600">Aucune personne ne correspond à cette recherche.</p> : null}
          {pageCount > 1 ? <div className="mt-3 flex items-center justify-between text-xs"><button type="button" disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="min-h-10 rounded border bg-white px-3 disabled:opacity-40">Précédent</button><span>Page {Math.min(page, pageCount - 1) + 1} sur {pageCount}</span><button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="min-h-10 rounded border bg-white px-3 disabled:opacity-40">Suivant</button></div> : null}

          {selection.status === "UNDER_REVIEW" ? <div className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-800"><p><strong>Source :</strong> Membres du Parcours</p><p>{items.length} candidats observés · {retained.length} retenus · {excluded} exclus</p><p>Parmi les retenus : {toAdd} à ajouter · {alreadyPresent} déjà présents</p></div> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {selection.status === "DRAFT" ? <button type="button" disabled={pending} onClick={() => run(() => reviewJourneyMemberSelectionAction(selectionInput()))} className="min-h-11 rounded-lg bg-cyan-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Examiner la sélection</button> : <>
              <button type="button" disabled={pending} onClick={() => run(() => returnJourneyMemberSelectionToDraftAction(selectionInput()))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Revenir à la liste</button>
              <button type="button" disabled={pending} onClick={() => run(() => validateJourneyMemberSelectionAction(selectionInput()))} className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Valider les participants</button>
            </>}
          </div>
        </div>
      ) : null}
      {message ? <p role="status" className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-slate-800">{message}</p> : null}
      {changedParticipants.length ? <ul className="mt-2 list-disc pl-6 text-sm text-amber-950">{changedParticipants.map((name) => <li key={name}>{name}</li>)}</ul> : null}
    </section>
  );
}
