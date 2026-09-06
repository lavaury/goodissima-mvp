"use client";

import { useEffect, useState } from "react";

const openEventName = "goodissima:open-governed-journey-preview";

const sections = [
  { id: "educational-journey-framework", title: "1. Cadre et Workspace", items: ["Besoin initial : organiser une situation impliquant plusieurs acteurs", "Workspace : espace de travail associé", "Vue consolidée du contexte", "Compteurs purement indicatifs dans cet exemple"] },
  { id: "educational-journey-participants", title: "2. Participants et responsabilités", items: ["Organisateur", "Participant attendu", "Invitation préparée", "Accès gouverné : jamais créé automatiquement"] },
  { id: "educational-journey-documents", title: "3. Documents et premières actions", items: ["Document attendu", "Réception déclarative", "Règles de confidentialité", "Action humaine restant à démarrer"] },
  { id: "educational-journey-communications", title: "4. Communications gouvernées", items: ["Communication préparée", "Communication active", "Communication terminée ou expirée", "Aucun média lancé automatiquement"] },
  { id: "educational-journey-human-interventions", title: "5. Interventions humaines", items: ["Invitation à transmettre", "Document à revoir", "Dossier à ouvrir", "Communication à examiner"] },
  { id: "educational-journey-review", title: "6. Revue de gouvernance", items: ["Motif et question à trancher", "Revue préparée", "Assistant facultatif", "Conduite et décision humaines", "Limite V1 : aucune décision ni revue automatique"] },
] as const;

export function GovernedJourneyEducationalPreview() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openPreview = () => setOpen(true);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener(openEventName, openPreview);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener(openEventName, openPreview);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <>
    <button type="button" data-boussole-id="governed-journey-educational-preview" onClick={() => setOpen(true)} className="mt-4 rounded-lg border border-cyan-300 bg-white px-4 py-2 text-sm font-bold text-cyan-900">
      Voir à quoi ressemble un parcours gouverné
    </button>
    {open ? <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="educational-journey-title" aria-describedby="educational-journey-notice">
      <section className="mx-auto my-4 max-w-5xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-cyan-800">Visite locale</p><h2 id="educational-journey-title" className="mt-1 text-2xl font-bold text-slate-950">Anatomie d’un parcours gouverné</h2></div>
          <button autoFocus type="button" data-boussole-id="close-governed-journey-educational-preview" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm font-bold" aria-label="Fermer l’exemple pédagogique">Fermer</button>
        </div>
        <p id="educational-journey-notice" role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-relaxed text-amber-950">Exemple pédagogique — aucun parcours créé, aucune donnée réelle, aucune action possible.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {sections.map((section) => <article key={section.id} data-boussole-id={section.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-bold text-slate-950">{section.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">{section.items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-cyan-700">•</span><span>{item}</span></li>)}</ul>
          </article>)}
        </div>
      </section>
    </div> : null}
  </>;
}

export const governedJourneyEducationalPreviewEvent = openEventName;
