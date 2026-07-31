"use client";

import { useEffect, useRef, useState } from "react";
import { DirectoryValidationError, parseCreateRepresentationInput, parseUpdateRepresentationInput, REPRESENTATION_TYPES } from "@/lib/directory/contracts";
import { representationTypeLabels, type DirectoryRepresentation } from "@/components/directory/directory-ui";

type FormValues = { type: string; displayName: string; title: string; organizationName: string; territory: string; description: string };

function valuesFor(representation: DirectoryRepresentation | null): FormValues {
  return {
    type: representation?.type ?? "PROFESSIONAL",
    displayName: representation?.displayName ?? "",
    title: representation?.title ?? "",
    organizationName: representation?.organizationName ?? "",
    territory: representation?.territory ?? "",
    description: representation?.description ?? "",
  };
}

function optional(value: string, clearEmpty: boolean) { return value.trim() ? value : clearEmpty ? null : undefined; }

export function RepresentationEditor({ representation, onCancel, onSaved }: {
  representation: DirectoryRepresentation | null;
  onCancel: () => void;
  onSaved: (representation: DirectoryRepresentation) => void;
}) {
  const [values, setValues] = useState(() => valuesFor(representation));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  useEffect(() => { firstInput.current?.focus(); }, []);

  function update(field: keyof FormValues, value: string) { setValues((current) => ({ ...current, [field]: value })); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    const raw = {
      type: values.type,
      displayName: values.displayName,
      title: optional(values.title, Boolean(representation)),
      organizationName: optional(values.organizationName, Boolean(representation)),
      territory: optional(values.territory, Boolean(representation)),
      description: optional(values.description, Boolean(representation)),
      ...(representation ? { expectedUpdatedAt: representation.updatedAt } : {}),
    };
    try {
      const body = representation ? parseUpdateRepresentationInput(raw) : parseCreateRepresentationInput(raw);
      setSubmitting(true);
      const response = await fetch(representation ? `/api/directory/representations/${encodeURIComponent(representation.id)}` : "/api/directory/representations", {
        method: representation ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (response.status === 409) throw new Error("Cette représentation a été modifiée depuis son ouverture. Actualisez la page avant de recommencer.");
      if (!response.ok || !payload.representation) throw new Error("La représentation n’a pas pu être enregistrée. Vérifiez les champs et réessayez.");
      onSaved(payload.representation);
    } catch (caught) {
      if (caught instanceof DirectoryValidationError) setError("Vérifiez les champs obligatoires et les longueurs saisies.");
      else setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border bg-slate-50 p-4 sm:p-5" aria-describedby="representation-privacy representation-form-error">
      <h3 className="text-lg font-semibold text-slate-950">{representation ? "Modifier la représentation" : "Créer une représentation"}</h3>
      <p id="representation-privacy" className="mt-2 text-sm font-medium text-emerald-800">Cette représentation est privée et n’apparaît pas dans l’Annuaire global.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">Nom affiché <span aria-hidden="true">*</span>
          <input ref={firstInput} required maxLength={120} value={values.displayName} onChange={(event) => update("displayName", event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-800">Type <span aria-hidden="true">*</span>
          <select required value={values.type} onChange={(event) => update("type", event.target.value)} className={inputClass}>
            {REPRESENTATION_TYPES.map((type) => <option key={type} value={type}>{representationTypeLabels[type]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">Fonction
          <input maxLength={160} value={values.title} onChange={(event) => update("title", event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-800">Organisation
          <input maxLength={160} value={values.organizationName} onChange={(event) => update("organizationName", event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">Territoire
          <input maxLength={120} value={values.territory} onChange={(event) => update("territory", event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">Description
          <textarea maxLength={2000} rows={5} value={values.description} onChange={(event) => update("description", event.target.value)} className={inputClass} />
        </label>
      </div>
      {error ? <p id="representation-form-error" role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={submitting} onClick={onCancel} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Annuler</button>
        <button type="submit" disabled={submitting} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}
