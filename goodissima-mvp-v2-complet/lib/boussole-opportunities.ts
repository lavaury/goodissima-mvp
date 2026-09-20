import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

const step = (id: string, targetId: string, title: string, body: string, glossaryTermIds: string[] = []): CompassStep => ({ id, targetId, title, body, detailedBody: body, glossaryTermIds, animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true } });

export const opportunitySequences: BoussoleSequence[] = [
  { id: "discover-opportunities", title: "Découvrir les opportunités", description: "Comprendre la collection et créer une opportunité.", steps: [
    step("opportunities-page", "opportunities-overview", "La collection Opportunités", "Cette page rassemble les besoins et les offres que vous avez créés.", ["opportunite"]),
    step("opportunities-create", "create-opportunity", "Créer une opportunité", "Cette action prépare une nouvelle opportunité. Elle ne la publie pas automatiquement.", ["opportunite", "validation-humaine"]),
    step("opportunities-summary", "opportunities-summary", "Suivre les statuts", "Ces compteurs distinguent les brouillons, les opportunités publiées, suspendues et clôturées.", ["statut", "cycle-de-vie"]),
  ] },
  { id: "filter-opportunities", title: "Rechercher et filtrer", description: "Réduire la collection avec les contrôles disponibles.", steps: [
    step("opportunities-filter", "opportunities-filters", "Filtrer par statut", "Choisissez un statut pour n’afficher que les opportunités correspondantes.", ["statut"]),
    step("opportunities-search", "opportunities-search", "Rechercher localement", "La recherche porte sur le titre, le sujet et le lieu des opportunités déjà affichées."),
    step("opportunities-archives", "open-archives", "Consulter les archives", "Les archives restent disponibles dans une vue secondaire.", ["archivage"]),
  ] },
  { id: "read-opportunity", title: "Lire une opportunité", description: "Lire la première opportunité réelle visible.", applicableStates: ["POPULATED", "FOCUSED"], steps: [
    step("opportunity-title", "opportunity-card-title", "Identifier l’opportunité", "Le titre identifie rapidement le besoin ou l’offre.", ["opportunite"]),
    step("opportunity-status", "opportunity-card-status", "Lire son statut", "Le statut situe l’opportunité dans son cycle de vie.", ["statut", "cycle-de-vie"]),
    step("opportunity-open", "open-opportunity", "Ouvrir l’opportunité", "Cette action ouvre la fiche autonome ou, pour un ancien objet, sa fiche historique."),
  ] },
];

export const opportunitySteps = opportunitySequences.flatMap((sequence) => sequence.steps);
