import { representationStatusLabels, representationTypeLabels, type DirectoryRepresentation } from "@/components/directory/directory-ui";

export function RepresentationCard({ representation, busy, actionsDisabled, onEdit, onTransition }: {
  representation: DirectoryRepresentation;
  busy: boolean;
  actionsDisabled: boolean;
  onEdit: () => void;
  onTransition: (action: "hide" | "restore" | "archive") => void;
}) {
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
