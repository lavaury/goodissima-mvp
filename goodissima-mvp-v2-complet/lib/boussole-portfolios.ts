import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";
const step = (id: string, targetId: string, title: string, body: string, glossaryTermIds: string[] = []): CompassStep => ({ id, targetId, title, body, detailedBody: body, glossaryTermIds, animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true } });
export const portfolioSequences: BoussoleSequence[] = [
  { id: "portfolio-landmarks", title: "Prendre ses repères", description: "Comprendre la page et créer un regroupement.", steps: [
    step("portfolios-page", "portfolios-overview", "Comprendre les Portfolios", "Cette page rassemble les Portfolios disponibles. Ils organisent plusieurs espaces de travail dans une vue produit ou métier commune.", ["portfolio"]),
    step("portfolios-workspace", "portfolios-workspace-explanation", "Portfolio ou Workspace ?", "Un Portfolio regroupe plusieurs Workspaces. Un Workspace organise les parcours, liens, dossiers et communications d’un même contexte.", ["portfolio", "workspace"]),
    step("portfolios-create", "create-portfolio", "Créer un Portfolio", "Créez un Portfolio pour regrouper plusieurs Workspaces. Aucun Workspace n’est créé ou rattaché automatiquement.", ["portfolio", "workspace", "validation-humaine"]),
    step("portfolios-empty", "no-portfolios", "Aucun Portfolio", "Aucun Portfolio réel n’est encore présent. Vous pouvez en créer un sans ajouter de donnée fictive.", ["portfolio"]),
  ] },
  { id: "portfolio-card", title: "Lire une carte Portfolio", description: "Lire le premier Portfolio réel visible.", steps: [
    step("portfolio-first", "first-portfolio-card", "Carte Portfolio", "Cette première carte réelle représente un Portfolio existant.", ["portfolio"]),
    step("portfolio-card-name", "portfolio-name", "Nom", "Le nom identifie le regroupement de Workspaces.", ["portfolio"]),
    step("portfolio-card-status", "portfolio-status", "Statut", "Le statut indique l’état réellement pris en charge pour ce Portfolio.", ["statut", "portfolio"]),
    step("portfolio-card-type", "portfolio-type", "Type", "Le type affiché précise le domaine ou l’usage réel de ce Portfolio.", ["portfolio"]),
    step("portfolio-card-description", "portfolio-description", "Description", "Cette description résume la finalité du Portfolio.", ["portfolio"]),
  ] },
  { id: "portfolio-counters", title: "Compteurs et périmètre V1", description: "Comprendre les données consolidées et les limites présentes.", steps: [
    step("portfolio-workspaces", "portfolio-workspaces-count", "Workspaces", "Ce nombre indique combien de Workspaces sont regroupés dans ce Portfolio.", ["workspace", "portfolio"]),
    step("portfolio-objects", "portfolio-objects-count", "Objets", "Ce compteur représente les objets rattachés selon le calcul réel de Goodissima. Il est informatif.", ["objet", "portfolio"]),
    step("portfolio-cases", "portfolio-cases-count", "Dossiers", "Ce compteur indique le nombre de dossiers consolidés dans le périmètre du Portfolio.", ["dossier", "portfolio"]),
    step("portfolio-communications", "portfolio-communications-count", "Communications", "Ce compteur indique les communications rattachées au périmètre du Portfolio.", ["communication-securisee", "portfolio"]),
    step("portfolio-open", "open-portfolio", "Ouvrir le Portfolio", "Ouvrez ce Portfolio pour consulter ses Workspaces et les informations consolidées. La Boussole ne l’active pas.", ["portfolio", "validation-humaine"]),
    step("portfolio-limit", "portfolio-v1-limit", "Périmètre de la V1", "En V1, le Portfolio regroupe principalement les Workspaces. Le pilotage consolidé, les signaux et l’assistance IA restent des évolutions futures, pas des fonctions disponibles.", ["portfolio", "workspace"]),
  ] },
];
export const portfolioSteps = portfolioSequences.flatMap((sequence) => sequence.steps);
