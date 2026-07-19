import { dashboardSteps } from "./boussole-dashboard.ts";
import { simpleLinkSteps } from "./boussole-simple-link.ts";
import { opportunitySteps } from "./boussole-opportunities.ts";
import { governanceSteps } from "./boussole-governance.ts";
import { portfolioSteps } from "./boussole-portfolios.ts";
import { newGovernedJourneySteps } from "./boussole-new-governed-journey.ts";
import { governedJourneySteps } from "./boussole-governed-journey.ts";
import { dossierSteps } from "./boussole-dossiers.ts";

export type CompassStep = { id?: string; title: string; body: string; detailedBody?: string; targetId?: string; targetStates?: string[]; glossaryTermIds?: string[]; optional?: boolean; fallbackTargetId?: string; animation?: { focus: string; movement: string; narration: string; subtitles: string; duration: number; transition: string; tryNow: boolean } };
export type CompassContext = { id: string; pageName: string; summary: string; caution: string; steps: CompassStep[] };

const contexts: CompassContext[] = [
  { id: "simple-link", pageName: "Créer un lien simple", summary: "Vous êtes dans le constructeur de lien simple. Il permet de créer rapidement un formulaire sécurisé à partir d’un modèle ou de vos propres champs.", caution: "Cette page structure un besoin sans créer un parcours gouverné complet. Commencez par choisir un modèle ou renseignez directement le titre.", steps: simpleLinkSteps },
  { id: "link-owner", pageName: "Lien sécurisé", summary: "Cette page permet de gérer le lien, vérifier son formulaire et examiner son matching avant toute réponse candidate.", caution: "Le matching du lien analyse le besoin initial ; le matching d’un dossier devient plus précis après une réponse. Aucun contact n’est automatique.", steps: [
    { title: "Comprendre l’état du matching", body: "L’état indique si le matching est désactivé, à analyser, à examiner ou sans résultat exploitable.", targetId: "link-matching-status", glossaryTermIds: ["matching-relationnel", "correspondance-potentielle"] },
    { title: "Activer le matching", body: "Activez-le seulement après confirmation humaine. L’activation ne lance pas l’analyse.", targetId: "enable-link-matching" },
    { title: "Analyser le matching", body: "Cette action compare manuellement le besoin du lien aux opportunités existantes.", targetId: "analyze-link-matching" },
    { title: "Examiner les correspondances", body: "Lisez les éléments compatibles et les clarifications avant toute décision.", targetId: "review-link-matches" },
    { title: "Décider de la suite", body: "Marquer une correspondance intéressante ne crée aucune relation ni aucun contact.", targetId: "decide-link-match" },
    { title: "Copier le lien", body: "Copiez le lien public stable pour le transmettre vous-même.", targetId: "copy-public-link" },
    { title: "Ouvrir le formulaire public", body: "Vérifiez le formulaire public sans créer de dossier.", targetId: "open-public-link" },
    { title: "Comprendre l’admission", body: "Consultez la règle appliquée avant toute réponse réelle. Aucun accès candidat n’est créé avant une soumission.", targetId: "explain-link-admission", glossaryTermIds: ["admission", "candidat"] },
    { title: "Ouvrir la Salle de pilotage", body: "Les actions de matching à traiter sont également consolidées dans la Salle de pilotage.", targetId: "open-governance-pilotage" },
  ] },
  { id: "governed-journey", pageName: "Parcours gouverné", summary: "Le cockpit rassemble le cadrage, le Workspace, le pilotage, les invitations, les communications et les revues du parcours.", caution: "Chaque préparation et validation reste humaine. La Boussole n’ouvre aucun accès et ne lance aucune action.", steps: governedJourneySteps },
  { id: "new-governed-journey", pageName: "Créer un parcours gouverné", summary: "Vous préparez un parcours destiné à organiser une situation nécessitant plusieurs acteurs, étapes ou décisions.", caution: "Commencez par décrire clairement l’objectif. La création prépare un brouillon : aucun participant n’est invité, aucun accès n’est ouvert et aucun workflow n’est lancé automatiquement.", steps: newGovernedJourneySteps },
  { id: "portfolio", pageName: "Comprendre les Portfolios", summary: "Vous êtes dans l’espace qui regroupe plusieurs Workspaces dans une vue produit ou métier commune.", caution: "Créez un Portfolio ou ouvrez un Portfolio existant. En V1, ce regroupement ne lance aucune action automatiquement.", steps: portfolioSteps },
  { id: "pilotage", pageName: "Pilotage", summary: "La salle de pilotage présente des signaux déterministes et les contextes qui nécessitent votre attention.", caution: "Elle ne traite aucun signal et n’exécute aucun workflow automatiquement.", steps: [
    { title: "Traiter le premier signal de matching", body: "Ce lien est candidat au matching. Ouvrez-le pour analyser ou examiner les correspondances.", targetId: "open-pilotage-matching-signal" },
    { title: "Traiter la première situation visible", body: "Lisez la raison du signal avant d’ouvrir son contexte. La Boussole ne réalise pas l’action.", targetId: "pilotage-signal-action" },
    { title: "Comprendre la Salle de pilotage", body: "Cette page rassemble les situations qui nécessitent votre intervention. Elle ne déclenche aucune action automatiquement.", targetId: "pilotage-overview" },
    { title: "Demander une synthèse", body: "L’assistant explique les signaux mais ne traite aucune action.", targetId: "pilotage-assistant" },
    { title: "Revenir à la gouvernance", body: "Changez de grande zone pour retrouver les Workspaces et parcours.", targetId: "open-governance" },
  ] },
  { id: "governance", pageName: "Comprendre Gouvernance", summary: "Vous êtes dans l’espace Gouvernance de Goodissima. Il organise les situations qui nécessitent plusieurs participants, des responsabilités, des invitations, des revues ou un pilotage structuré.", caution: "Créez un parcours gouverné ou ouvrez un parcours existant pour examiner son pilotage. Les décisions, invitations et revues restent humaines.", steps: governanceSteps },
  { id: "dashboard", pageName: "Dashboard", summary: "Le Dashboard donne une vue d’ensemble de l’activité et des éléments qui demandent votre attention.", caution: "Les indicateurs orientent votre lecture mais ne décident pas des priorités à votre place.", steps: dashboardSteps },
  { id: "archives", pageName: "Archives des opportunités", summary: "Vous consultez les opportunités retirées de la vue active. Elles restent disponibles dans l’historique sans être présentées comme supprimées.", caution: "Consulter une archive ne la republie pas et ne relance aucune relation.", steps: opportunitySteps },
  { id: "opportunities", pageName: "Gérer les opportunités", summary: "Vous êtes dans l’espace qui rassemble les besoins, offres et annonces susceptibles de donner lieu à une relation. Retrouvez, examinez et gérez ici les opportunités créées dans Goodissima.", caution: "Recherchez une opportunité dans la liste ou utilisez les vues disponibles pour afficher celles qui demandent votre attention. Aucune publication, relation ou action n’est automatique.", steps: opportunitySteps },
  { id: "dossiers", pageName: "Dossier relationnel sécurisé", summary: "Ce dossier rassemble la conversation, les documents et les communications d’une relation autorisée créée après une réponse ou une mise en relation acceptée.", caution: "Chaque message, document et connexion à la salle exige une action humaine explicite. La Boussole ne transmet rien automatiquement.", steps: dossierSteps },
  { id: "directory", pageName: "Annuaire", summary: "L’Annuaire aide à retrouver une identité et à préparer une relation dans un cadre de confiance.", caution: "Il n’expose pas de coordonnées sensibles et ne crée aucune relation automatiquement.", steps: [
    { title: "Comprendre l’identité", body: "Consultez les informations d’identité et de confiance disponibles.", targetId: "directory-identity" },
    { title: "Ouvrir la gouvernance", body: "Préparez ensuite le contexte relationnel depuis la gouvernance si nécessaire.", targetId: "open-governance" },
  ] },
  { id: "settings", pageName: "Paramètres et IA", summary: "Les paramètres regroupent les réglages disponibles et les contrôles applicables à votre compte.", caution: "L’IA assiste et propose ; elle ne publie, ne contacte et ne décide jamais seule.", steps: [
    { title: "Comprendre la gouvernance IA", body: "Vérifiez le fournisseur, le modèle et les principes d’assistance visibles.", targetId: "ai-governance-settings" },
    { title: "Comprendre IA et valeur", body: "Consultez la zone IA et valeur pour comprendre les aides disponibles.", targetId: "open-ai-value" },
  ] },
  { id: "journeys", pageName: "Parcours", summary: "Les parcours structurent les informations, étapes et validations associées à une opportunité.", caution: "Une proposition IA reste un brouillon tant qu’un humain ne l’a pas relue et validée.", steps: [
    { title: "Ouvrir les parcours", body: "Consultez les parcours existants avant d’en préparer un nouveau.", targetId: "open-journeys" },
    { title: "Créer un parcours gouverné", body: "La gouvernance permet de préparer un parcours rattaché à un Workspace.", targetId: "create-governed-journey" },
  ] },
  { id: "relations", pageName: "Communications sécurisées", summary: "Les relations donnent accès aux dossiers et canaux autorisés dans leur contexte.", caution: "Aucun message, appel, média ou accès ne démarre sans action explicite de l’utilisateur.", steps: [
    { title: "Consulter les relations", body: "Ouvrez vous-même une relation autorisée pour voir ses canaux disponibles.", targetId: "open-relations" },
    { title: "Consulter les dossiers", body: "Retrouvez la liste des dossiers relationnels ouverts.", targetId: "open-dossiers" },
  ] },
  { id: "boussole", pageName: "Boussole", summary: "La documentation Boussole détaille le rôle de chaque menu et les limites de la V1.", caution: "Cette aide reste informative et ne déclenche aucune action.", steps: [
    { title: "Revenir au Dashboard", body: "Utilisez le Dashboard pour reprendre votre activité.", targetId: "open-dashboard" },
  ] },
];

export function getCompassContext(pathname: string, search = "") {
  if (pathname === "/links/simple") return contexts.find((item) => item.id === "simple-link")!;
  if (/^\/links\/[^/]+$/.test(pathname) && pathname !== "/links/new") return contexts.find((item) => item.id === "link-owner")!;
  if (pathname.startsWith("/gouvernance/parcours/")) return contexts.find((item) => item.id === "governed-journey")!;
  if (pathname === "/gouvernance/nouveau") return contexts.find((item) => item.id === "new-governed-journey")!;
  if (pathname.startsWith("/gouvernance/portfolios")) return contexts.find((item) => item.id === "portfolio")!;
  if (pathname.startsWith("/gouvernance/pilotage")) return contexts.find((item) => item.id === "pilotage")!;
  if (pathname.startsWith("/gouvernance")) return contexts.find((item) => item.id === "governance")!;
  if (pathname.startsWith("/dashboard")) return contexts.find((item) => item.id === "dashboard")!;
  if (pathname.startsWith("/opportunities") && search.includes("view=archived")) return contexts.find((item) => item.id === "archives")!;
  if (pathname.startsWith("/opportunities") || pathname.startsWith("/links")) return contexts.find((item) => item.id === "opportunities")!;
  if (pathname.startsWith("/cases")) return contexts.find((item) => item.id === "dossiers")!;
  if (pathname.startsWith("/annuaire")) return contexts.find((item) => item.id === "directory")!;
  if (pathname.startsWith("/settings") || pathname.startsWith("/ia-valeur")) return contexts.find((item) => item.id === "settings")!;
  if (pathname.startsWith("/parcours") || pathname.startsWith("/templates")) return contexts.find((item) => item.id === "journeys")!;
  if (pathname.startsWith("/relations")) return contexts.find((item) => item.id === "relations")!;
  if (pathname.startsWith("/boussole")) return contexts.find((item) => item.id === "boussole")!;
  return null;
}

export function isCompassPageName(value: string) {
  return contexts.some((context) => context.pageName === value);
}

export function getAllCompassContexts() { return contexts; }
