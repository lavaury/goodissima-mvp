import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";
const step = (id: string, targetId: string, title: string, body: string, optional = false): CompassStep => ({
  id, targetId, title, body, detailedBody: body, optional, glossaryTermIds: ["portfolio", "workspace"],
  animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true },
});
export const portfolioDetailSequences: BoussoleSequence[] = [{
  id: "explore-portfolio", title: "Explorer ce Portfolio", description: "Ouvrir ses Workspaces et retrouver les actions d’organisation.", applicableStates: ["FOCUSED"], steps: [
    step("portfolio-detail-landmark", "portfolio-detail-overview", "Ce Portfolio", "Vous avez ouvert un Portfolio réel. Ses Workspaces sont présentés dans la même géographie que Mes espaces."),
    step("portfolio-detail-children", "portfolio-workspaces", "Ses Workspaces", "Cette liste contient uniquement les Workspaces rattachés à ce Portfolio et accessibles à votre compte."),
    step("portfolio-detail-empty", "portfolio-no-workspaces", "Aucun Workspace", "Le Portfolio existe sans Workspace. Organiser permet de rattacher un Workspace existant lorsque le Portfolio est actif.", true),
    step("portfolio-detail-first", "portfolio-first-workspace", "Un Workspace réel", "Cette ligne montre un Workspace contenu dans ce Portfolio, son statut et ses compteurs directs.", true),
    step("portfolio-detail-open", "open-workspace", "Ouvrir le Workspace", "Ce lien ouvre le Workspace. La Boussole le montre sans naviguer à votre place.", true),
    step("portfolio-detail-organize", "portfolio-organize", "Organiser", "Développez ce panneau pour rattacher ou détacher un Workspace. La Boussole montre sa commande sans exécuter ces actions."),
    step("portfolio-detail-pilotage", "portfolio-open-pilotage", "Piloter", "Ce lien ouvre le pilotage existant de ce Portfolio. Ses signaux ne sont pas une simple somme des vues Workspace."),
  ],
}];
export const portfolioDetailSteps = portfolioDetailSequences.flatMap(journey => journey.steps);
export const portfolioPilotageSequences: BoussoleSequence[] = [{
  id: "understand-portfolio-pilotage", title: "Lire le pilotage du Portfolio", description: "Situer le périmètre des signaux et de l’assistant.", applicableStates: ["FOCUSED"], steps: [
    step("portfolio-pilotage-landmark", "portfolio-pilotage-overview", "Pilotage du Portfolio", "Cette page présente les signaux calculés dans le périmètre du Portfolio ouvert. Les liens conduisent aux contextes concernés ; aucune action n’est exécutée par la Boussole. L’assistant permet aussi de choisir explicitement tout votre pilotage."),
  ],
}];
export const portfolioPilotageSteps = portfolioPilotageSequences.flatMap(journey => journey.steps);
