import { useEffect, useState } from "react";
import { representationStatusLabels, representationTypeLabels, type DirectoryRepresentation } from "@/components/directory/directory-ui";
import { REPRESENTATION_RELATIONSHIP_POLICIES, representationRelationshipPolicyDescriptions, representationRelationshipPolicyLabels, type RepresentationRelationshipPolicy } from "@/lib/directory/contracts";
import { representationVisibilityDescriptions, representationVisibilityLabels, type RepresentationVisibility } from "@/lib/directory/contracts";

export function RepresentationCard({ representation, busy, actionsDisabled, onEdit, onTransition, onPolicySave, onVisibilityChange }: {
  representation: DirectoryRepresentation;
  busy: boolean;
  actionsDisabled: boolean;
  onEdit: () => void;
  onTransition: (action: "hide" | "restore" | "archive") => void;
  onPolicySave: (policy: RepresentationRelationshipPolicy) => Promise<boolean>;
  onVisibilityChange: (visibility: RepresentationVisibility) => void;
}) {
  const [selectedPolicy, setSelectedPolicy] = useState(representation.relationshipPolicy);
  const [policyError, setPolicyError] = useState<string | null>(null);
  useEffect(() => setSelectedPolicy(representation.relationshipPolicy), [representation.relationshipPolicy]);

  async function savePolicy() {
    setPolicyError(null);
    if (!await onPolicySave(selectedPolicy)) setPolicyError("La politique n’a pas pu être enregistrée. Vérifiez le message ci-dessus.");
  }

  return (
    <article className="flex flex-col rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{representationTypeLabels[representation.type]}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{representation.displayName}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {representationStatusLabels[representation.status]}
        </span>
      </div>
      <dl className="mt-4 space-y-2 text-sm text-slate-700">
        {representation.title ? <div><dt className="sr-only">Fonction</dt><dd>{representation.title}</dd></div> : null}
        {representation.organizationName ? <div><dt className="sr-only">Organisation</dt><dd>{representation.organizationName}</dd></div> : null}
        {representation.territory ? <div><dt className="sr-only">Territoire</dt><dd>Territoire : {representation.territory}</dd></div> : null}
        {representation.description ? <div><dt className="sr-only">Description</dt><dd className="whitespace-pre-wrap leading-6">{representation.description}</dd></div> : null}
      </dl>
      <section aria-labelledby={`visibility-${representation.id}`} className="mt-5 rounded-xl border p-4">
        <h4 id={`visibility-${representation.id}`} className="text-sm font-semibold text-slate-950">Visibilité</h4>
        <p className="mt-2 text-sm font-semibold text-slate-800">{representationVisibilityLabels[representation.visibility]}</p>
        <p className="mt-1 text-sm leading-5 text-slate-600">{representationVisibilityDescriptions[representation.visibility]}</p>
        {representation.status !== "ACTIVE" ? (
          <p className="mt-3 text-sm text-slate-600">La représentation doit être active pour être publiée.</p>
        ) : (
          <button type="button" disabled={actionsDisabled} onClick={() => onVisibilityChange(representation.visibility === "PRIVATE" ? "DISCOVERABLE" : "PRIVATE")} className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">
            {representation.visibility === "PRIVATE" ? "Rendre visible dans l’Annuaire" : "Retirer de l’Annuaire"}
          </button>
        )}
      </section>
      <fieldset className="mt-5 rounded-xl border bg-slate-50 p-4" disabled={actionsDisabled}>
        <legend className="px-1 text-sm font-semibold text-slate-950">Politique relationnelle</legend>
        <div className="mt-2 space-y-3">
          {REPRESENTATION_RELATIONSHIP_POLICIES.map((policy) => (
            <label key={policy} className="flex cursor-pointer items-start gap-3">
              <input type="radio" name={`relationship-policy-${representation.id}`} value={policy} checked={selectedPolicy === policy} onChange={() => setSelectedPolicy(policy)} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{representationRelationshipPolicyLabels[policy]}</span>
                <span className="block text-sm leading-5 text-slate-600">{representationRelationshipPolicyDescriptions[policy]}</span>
              </span>
            </label>
          ))}
        </div>
        {policyError ? <p role="alert" className="mt-3 text-sm text-red-700">{policyError}</p> : null}
        <button type="button" disabled={actionsDisabled || selectedPolicy === representation.relationshipPolicy} onClick={savePolicy} className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Enregistrement…" : "Enregistrer la politique"}
        </button>
      </fieldset>
      <p className="mt-4 text-xs text-slate-500">Mise à jour le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(representation.updatedAt))}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-4" aria-label={`Actions pour ${representation.displayName}`}>
        {representation.status !== "ARCHIVED" ? (
          <button type="button" disabled={actionsDisabled} onClick={onEdit} className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Modifier</button>
        ) : null}
        {representation.status === "ACTIVE" ? (
          <button type="button" disabled={actionsDisabled} onClick={() => onTransition("hide")} className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Masquer</button>
        ) : null}
        {representation.status === "HIDDEN" ? (
          <button type="button" disabled={actionsDisabled} onClick={() => onTransition("restore")} className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Réactiver</button>
        ) : null}
        {representation.status !== "ARCHIVED" ? (
          <button type="button" disabled={actionsDisabled} onClick={() => onTransition("archive")} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Archiver</button>
        ) : (
          <button type="button" disabled={actionsDisabled} onClick={() => onTransition("restore")} className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Restaurer</button>
        )}
        {busy ? <span role="status" className="self-center text-sm text-slate-500">Mise à jour…</span> : null}
      </div>
    </article>
  );
}
