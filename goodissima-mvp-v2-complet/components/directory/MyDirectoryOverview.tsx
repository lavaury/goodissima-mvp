"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { RepresentationEditor } from "@/components/directory/RepresentationEditor";
import { RepresentationList } from "@/components/directory/RepresentationList";
import { representationTypeLabels, sortRepresentations, type DirectoryRepresentation } from "@/components/directory/directory-ui";
import { representationRelationshipPolicyLabels, type RepresentationRelationshipPolicy, type RepresentationVisibility } from "@/lib/directory/contracts";
import { ContactRequestsPanel, type RequestRow } from "@/components/directory/ContactRequestsPanel";
import { MyContactsPanel, type ContactRow } from "@/components/directory/MyContactsPanel";

export function MyDirectoryOverview({ hasIdentity, initialRepresentations, initialIncomingRequests, initialOutgoingRequests, initialRequestView, initialContacts }: {
  hasIdentity: boolean;
  initialRepresentations: DirectoryRepresentation[];
  initialIncomingRequests: RequestRow[];
  initialOutgoingRequests: RequestRow[];
  initialRequestView: "incoming" | "outgoing";
  initialContacts: ContactRow[];
}) {
  const router = useRouter();
  const [representations, setRepresentations] = useState(() => sortRepresentations(initialRepresentations));
  const [editing, setEditing] = useState<DirectoryRepresentation | null | "create">(null);
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const sectionHeading = useRef<HTMLHeadingElement>(null);

  function closeEditor() {
    setEditing(null);
    window.setTimeout(() => sectionHeading.current?.focus(), 0);
  }

  function acceptRepresentation(representation: DirectoryRepresentation, message: string) {
    setRepresentations((current) => sortRepresentations([
      representation,
      ...current.filter((item) => item.id !== representation.id),
    ]));
    closeEditor();
    setFeedback(message);
    router.refresh();
  }

  async function transition(representation: DirectoryRepresentation, action: "hide" | "restore" | "archive") {
    if (mutationId) return;
    if (action === "archive" && !window.confirm("Archiver cette représentation ? Son historique sera conservé et elle pourra être restaurée.")) return;
    setMutationId(representation.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/directory/representations/${encodeURIComponent(representation.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedUpdatedAt: representation.updatedAt }),
      });
      const payload = await response.json();
      if (response.status === 409) throw new Error("Cette représentation a été modifiée depuis son ouverture. Actualisez la page avant de recommencer.");
      if (!response.ok || !payload.representation) throw new Error("L’action n’a pas pu être appliquée. Réessayez.");
      const labels = { hide: "La représentation est maintenant masquée.", restore: "La représentation est maintenant active. Elle reste privée.", archive: "La représentation a été archivée." };
      acceptRepresentation(payload.representation, labels[action]);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setMutationId(null);
    }
  }

  async function saveRelationshipPolicy(representation: DirectoryRepresentation, relationshipPolicy: RepresentationRelationshipPolicy) {
    if (mutationId) return false;
    setMutationId(representation.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/directory/representations/${encodeURIComponent(representation.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipPolicy, expectedUpdatedAt: representation.updatedAt }),
      });
      const payload = await response.json();
      if (response.status === 409) throw new Error("Cette représentation a été modifiée dans un autre onglet. Actualisez la page avant de recommencer.");
      if (!response.ok || !payload.representation) throw new Error("La politique relationnelle n’a pas pu être enregistrée. Réessayez.");
      setRepresentations((current) => sortRepresentations(current.map((item) => item.id === representation.id ? payload.representation : item)));
      setFeedback("La politique relationnelle a été enregistrée. Aucun canal ni aucune demande n’a été créé.");
      router.refresh();
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Une erreur est survenue.");
      return false;
    } finally {
      setMutationId(null);
    }
  }

  async function changeVisibility(representation: DirectoryRepresentation, visibility: RepresentationVisibility) {
    if (mutationId) return;
    if (visibility === "DISCOVERABLE") {
      const preview = [
        "Aperçu des informations visibles dans l’Annuaire global :",
        `Nom d’affichage : ${representation.displayName}`,
        `Type : ${representationTypeLabels[representation.type]}`,
        `Titre : ${representation.title ?? "Non renseigné"}`,
        `Organisation : ${representation.organizationName ?? "Non renseignée"}`,
        `Description : ${representation.description ?? "Non renseignée"}`,
        `Territoire : ${representation.territory ?? "Non renseigné"}`,
        `Politique relationnelle : ${representationRelationshipPolicyLabels[representation.relationshipPolicy]}`,
        "",
        "Aucune coordonnée personnelle ne sera affichée. Confirmer la publication ?",
      ].join("\n");
      if (!window.confirm(preview)) return;
    }
    setMutationId(representation.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/directory/representations/${encodeURIComponent(representation.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, expectedUpdatedAt: representation.updatedAt }),
      });
      const payload = await response.json();
      if (response.status === 409) throw new Error("Cette représentation a été modifiée depuis son ouverture ou ne peut pas être publiée dans son état actuel. Actualisez la page.");
      if (!response.ok || !payload.representation) throw new Error("La visibilité n’a pas pu être modifiée. Réessayez.");
      setRepresentations((current) => sortRepresentations(current.map((item) => item.id === representation.id ? payload.representation : item)));
      setFeedback(visibility === "DISCOVERABLE" ? "La représentation est maintenant visible dans l’Annuaire global." : "La représentation a été retirée de l’Annuaire global.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setMutationId(null);
    }
  }

  return (
    <div className="space-y-6" data-boussole-state={representations.length ? "POPULATED" : "EMPTY"}>
      <section aria-labelledby="my-representations-title" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Moi</p>
            <h2 ref={sectionHeading} tabIndex={-1} id="my-representations-title" className="mt-1 text-xl font-semibold text-slate-950 outline-none">Mes représentations</h2>
            <p className="mt-2 text-sm text-slate-600">Ces représentations sont privées et n’apparaissent pas dans l’Annuaire global.</p>
          </div>
          {hasIdentity && editing === null ? (
            <button type="button" onClick={() => setEditing("create")} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Créer une représentation
            </button>
          ) : null}
        </div>

        {feedback ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">{feedback}</p> : null}

        <div data-boussole-id="directory-identity" className={hasIdentity ? "mt-5 rounded-xl border bg-slate-50 p-4" : "mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"}>
          <p className={hasIdentity ? "font-semibold text-slate-950" : "font-semibold text-amber-950"}>{hasIdentity ? "Identité Goodissima liée" : "Identité Goodissima requise"}</p>
          <p className={hasIdentity ? "mt-2 text-sm text-slate-600" : "mt-2 text-sm text-amber-900"}>
            {hasIdentity ? "Vos représentations sont rattachées à votre identité et restent privées." : "Vous devez d’abord disposer d’une identité Goodissima avant de créer une représentation."}
          </p>
          {!hasIdentity ? <Link href="/identity" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ouvrir l’espace identité</Link> : null}
        </div>

        {!hasIdentity ? null : editing ? (
          <RepresentationEditor
            representation={editing === "create" ? null : editing}
            onCancel={closeEditor}
            onSaved={(representation) => acceptRepresentation(representation, editing === "create" ? "La représentation a été créée." : "La représentation a été mise à jour.")}
          />
        ) : representations.length ? (
          <RepresentationList representations={representations} mutationId={mutationId} onEdit={setEditing} onTransition={transition} onPolicySave={saveRelationshipPolicy} onVisibilityChange={changeVisibility} />
        ) : (
          <div className="mt-5 rounded-xl border border-dashed p-6 text-center">
            <p className="font-semibold text-slate-950">Aucune représentation</p>
            <p className="mt-2 text-sm text-slate-600">Créez votre première représentation lorsque vous êtes prêt.</p>
            <button type="button" onClick={() => setEditing("create")} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Créer ma première représentation</button>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <ContactRequestsPanel incoming={initialIncomingRequests} outgoing={initialOutgoingRequests} initialTab={initialRequestView} />
        <MyContactsPanel contacts={initialContacts} />
      </div>
      <p className="text-center text-sm text-slate-600">
        Besoin de préparer un contexte relationnel ? <Link data-boussole-id="open-governance" href="/gouvernance" className="font-semibold underline">Ouvrir la gouvernance</Link>
      </p>
    </div>
  );
}
