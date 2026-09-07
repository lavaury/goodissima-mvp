import type { CompassStep } from "./boussole-context.ts";
import type { BoussolePageState, BoussoleRuntimeContext } from "./boussole/contracts.ts";
export type BoussoleSequence = { id: string; title: string; description: string; applicableStates?: BoussolePageState[]; steps: CompassStep[] };
const step = (id: string, title: string, body: string): CompassStep => ({
  id, title, body, detailedBody: body, targetId: id,
  animation: { focus: id, movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true },
});
export function dashboardRuntimeContext(contextId: string | undefined, targets: string[]): Partial<BoussoleRuntimeContext> {
  if (contextId !== "dashboard") return {};
  const populated = targets.includes("dashboard-recent-activity");
  return { pageState: populated ? "POPULATED" : "EMPTY", visibleObjectCount: populated ? 1 : 0 };
}
export const dashboardSequences: BoussoleSequence[] = [
  { id: "repères", title: "Choisir une destination", description: "Comprendre les trois portes de Goodissima.", applicableStates: ["EMPTY", "POPULATED"], steps: [
    step("dashboard-menu", "Navigation principale", "La navigation donne accès aux trois grandes destinations. Montrer cette zone ne change pas de page."),
    step("open-boussole-from-dashboard", "Comprendre avec la Boussole", "La Boussole aide à comprendre les possibilités et à choisir comment commencer. L’ouverture reste votre choix."),
    step("dashboard-open-directory", "Trouver dans l’Annuaire", "L’Annuaire permet de trouver des personnes et organisations. Ce guide ne lance aucune recherche."),
    step("dashboard-open-spaces", "Travailler dans Mes espaces", "Mes espaces rassemble vos Portfolios et Workspaces. Vous choisissez vous-même l’espace à ouvrir."),
  ] },
  { id: "activité", title: "Lire l’activité récente", description: "Rouvrir le contexte de quelques événements réels.", applicableStates: ["POPULATED"], steps: [
    step("dashboard-recent-activity", "Événements récents", "Cette liste limitée présente des créations de liens, ouvertures de dossiers et dépôts de documents datés. Elle ne représente pas toute l’activité ni une mémoire gouvernée. Ouvrir un objet demande votre clic."),
  ] },
];
export const dashboardSteps = dashboardSequences.flatMap(sequence => sequence.steps);
