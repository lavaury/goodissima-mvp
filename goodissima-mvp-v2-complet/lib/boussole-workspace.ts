import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

const step = (id: string, targetId: string, title: string, body: string): CompassStep => ({
  id,
  targetId,
  title,
  body,
  detailedBody: body,
  glossaryTermIds: ["workspace"],
  animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true },
});

export const workspaceSequences: BoussoleSequence[] = [
  {
    id: "discover-workspace-pilotage",
    title: "Piloter cet espace",
    description: "Lire les volumes et les situations qui demandent votre attention.",
    applicableStates: ["FOCUSED"],
    steps: [
      step("workspace-pilotage-overview", "workspace-pilotage", "Piloter", "Cette vue rassemble les objets de cet espace et les situations réelles à examiner. La Boussole ne déclenche aucune action."),
      step("workspace-direct-objects", "workspace-volumes", "Objets de cet espace", "Ces compteurs présentent les parcours, liens et dossiers directement rattachés à cet espace."),
      step("workspace-attention-items", "workspace-attention", "À examiner", "Cette zone rassemble les situations qui demandent une intervention humaine. Une visite Boussole ne les traite pas."),
      step("workspace-upcoming-meetings", "workspace-upcoming", "Réunions à venir", "Cette section présente uniquement les réunions réellement prévues dans cet espace."),
      step("workspace-recent-communications", "workspace-recent", "Échanges récents", "Cette section présente les échanges récemment mis à jour et leur contexte accessible."),
    ],
  },
  {
    id: "discover-workspace-explorer",
    title: "Explorer cet espace",
    description: "Retrouver les objets directement rattachés à cet espace.",
    applicableStates: ["FOCUSED"],
    steps: [
      step("workspace-explorer-overview", "workspace-explorer", "Explorer", "Cette vue rassemble les parcours, liens et dossiers directement rattachés à cet espace."),
      step("workspace-explorer-objects", "workspace-explorer-objects", "Contenu de cet espace", "Ouvrez un objet réel pour consulter son contexte. La Boussole ne crée et n’ouvre aucun objet à votre place."),
    ],
  },
];

export const workspaceSteps = workspaceSequences.flatMap((sequence) => sequence.steps);
