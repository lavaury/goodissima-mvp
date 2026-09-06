import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

type Options = { glossary?: string[]; narration?: string; focus?: "outline" | "spotlight" | "zoom"; objectType?: import("./boussole/contracts.ts").BoussoleObjectType; functionalState?: string };
const realTargetStrategies: Record<string, import("./boussole/contracts.ts").BoussoleTargetStrategy> = {
  "governance-first-workspace": { kind: "FIRST_VISIBLE_MATCH", objectType: "WORKSPACE" },
  "governance-first-portfolio": { kind: "FIRST_VISIBLE_MATCH", objectType: "PORTFOLIO" },
  "governance-first-journey": { kind: "FIRST_VISIBLE_MATCH", objectType: "GOVERNED_JOURNEY", functionalState: "WITH_WORKSPACE" },
  "first-unassigned-governed-journey": { kind: "FIRST_VISIBLE_MATCH", objectType: "GOVERNED_JOURNEY", functionalState: "WITHOUT_WORKSPACE" },
  "first-unassigned-relational-case": { kind: "FIRST_VISIBLE_MATCH", objectType: "RELATION_CASE", functionalState: "WITHOUT_WORKSPACE" },
};
const step = (id: string, targetId: string, title: string, body: string, options: Options = {}): CompassStep => ({
  id, targetId, title, body, detailedBody: body, glossaryTermIds: options.glossary ?? [],
  targetStrategy: options.objectType ? { kind: "FIRST_VISIBLE_MATCH", objectType: options.objectType, functionalState: options.functionalState } : realTargetStrategies[targetId],
  animation: { focus: options.focus ?? "outline", movement: "scroll-center", narration: options.narration ?? body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true },
});

export const governanceSequences: BoussoleSequence[] = [
  { id: "understand-governance", title: "Comprendre Mes espaces", description: "Retrouver ses espaces de travail.", applicableStates: ["EMPTY", "POPULATED"], steps: [
    step("governance-page", "governance-overview", "Mes espaces", "Retrouvez vos Portfolios et leurs Workspaces, ainsi que vos Workspaces sans Portfolio.", { glossary: ["workspace", "portfolio"] }),
    step("governance-human", "governance-human-control-notice", "Des actions humaines", "Créer ou ouvrir un espace ne contacte personne. Les décisions, invitations et revues restent humaines.", { glossary: ["validation-humaine"] }),
  ] },
  { id: "governance-summary", title: "Lire la synthèse", description: "Lire le nombre de Workspaces accessibles et les états vides.", applicableStates: ["EMPTY", "POPULATED"], steps: [
    step("governance-workspace-count", "governance-workspaces-count", "Workspaces accessibles", "Le nombre comprend les Workspaces sous un Portfolio et ceux sans Portfolio.", { glossary: ["workspace"] }),
    step("governance-empty", "governance-empty-state", "Aucun Workspace", "Créez un Workspace avec « + Nouveau ». Aucun contenu fictif n’est ajouté.", { glossary: ["workspace"] }),
  ] },
  { id: "understand-workspaces", title: "Organiser mes espaces", description: "Comprendre la hiérarchie et ouvrir un espace réel.", applicableStates: ["EMPTY", "POPULATED"], steps: [
    step("governance-workspace-portfolio", "governance-workspace-portfolio-explanation", "Portfolio et Workspace", "Un Portfolio regroupe des Workspaces. Développer un Portfolio affiche ses Workspaces sans ouvrir une autre page.", { glossary: ["workspace", "portfolio"] }),
    step("governance-create-workspace", "create-workspace", "Créer un Workspace", "Le menu « + Nouveau » permet de créer un Workspace. Aucun parcours, lien ou dossier n’est créé automatiquement.", { glossary: ["workspace", "validation-humaine"] }),
    step("governance-create-portfolio", "create-portfolio", "Créer un Portfolio", "Créez un regroupement pour vos Workspaces. Aucun rattachement n’est effectué automatiquement.", { glossary: ["portfolio"] }),
    step("governance-open-portfolios", "governance-first-portfolio", "Mon premier Portfolio", "Le bouton développer/réduire reste sur cette page. Le lien Ouvrir conduit au Portfolio.", { glossary: ["portfolio"] }),
    step("governance-workspace-card", "governance-first-workspace", "Mon premier Workspace", "Ce Workspace réel apparaît sous son Portfolio ou dans la section sans Portfolio. La Boussole peut développer son Portfolio pour le montrer.", { glossary: ["workspace"] }),
    step("governance-workspace-objects", "workspace-object-counts", "Contenu direct", "Ces compteurs indiquent les parcours, liens et dossiers directement rattachés à ce Workspace.", { glossary: ["workspace", "rattachement"] }),
    step("spaces-open-workspace", "open-workspace", "Ouvrir le Workspace", "Ouvrez le Workspace pour retrouver Piloter, Explorer et sa création contextualisée. La Boussole ne l’ouvre pas à votre place.", { glossary: ["workspace", "validation-humaine"] }),
  ] },
  { id: "organize-unassigned", title: "Organiser les éléments sans Workspace", description: "Comprendre le rattachement manuel d’objets qui existent déjà.", applicableStates: ["POPULATED"], steps: [
    step("unassigned-journeys", "governed-journeys-without-workspace", "Parcours gouvernés sans Workspace", "Cette section présente des parcours existants qui ne sont encore rattachés à aucun Workspace. Le parcours reste utilisable : le rattachement est une organisation volontaire.", { glossary: ["parcours-gouverne", "workspace", "rattachement-manuel", "parcours-sans-workspace"] }),
    step("unassigned-first-journey", "first-unassigned-governed-journey", "Parcours à organiser", "Ce premier parcours réel existe déjà mais n’est rattaché à aucun Workspace.", { glossary: ["parcours-sans-workspace"] }),
    step("unassigned-journey-title", "unassigned-journey-title", "Titre du parcours", "Le titre décrit l’objectif du parcours.", { glossary: ["parcours-gouverne"] }),
    step("unassigned-journey-date", "unassigned-journey-created-at", "Date de création", "Cette date indique quand le parcours a été créé.", { glossary: ["parcours-sans-workspace"] }),
    step("unassigned-open-cockpit", "open-unassigned-journey-cockpit", "Ouvrir le cockpit", "Le cockpit permet d’examiner le parcours avant de décider de son rattachement. La Boussole ne l’ouvre pas.", { glossary: ["cockpit-consolide", "validation-humaine"] }),
    step("unassigned-select-workspace", "select-workspace-for-journey", "Choisir un Workspace", "Sélectionnez l’espace correspondant au contexte du parcours. Le choix ne produit aucun effet avant confirmation.", { glossary: ["workspace", "rattachement-manuel"] }),
    step("unassigned-attach-journey", "attach-journey-to-workspace", "Rattacher le parcours", "Cette action organise le parcours dans le Workspace choisi. Elle ne crée aucun parcours, invitation, accès ou workflow.", { glossary: ["rattachement-manuel", "validation-humaine"] }),
    step("unassigned-create-workspace", "create-workspace-from-unassigned-journeys", "Créer un Workspace", "Créez un espace seulement si aucun Workspace existant ne convient. Sa création ne rattache pas automatiquement le parcours.", { glossary: ["workspace", "validation-humaine"] }),
    step("unassigned-no-workspace", "no-workspace-available-for-attachment", "Aucun Workspace disponible", "Créez d’abord un Workspace avant de pouvoir organiser ces éléments.", { glossary: ["workspace"] }),
    step("unassigned-none", "no-unassigned-governed-journeys", "Tous les parcours sont organisés", "Tous les parcours gouvernés visibles sont déjà organisés dans un Workspace.", { glossary: ["workspace", "parcours-gouverne"] }),
    step("unassigned-cases-zone", "relational-cases-workspace-attachment", "Rattachement aux Workspaces", "Cette section organise des dossiers et liens existants sans modifier les accès candidats, envoyer de notification ou créer de lien.", { glossary: ["dossier-relationnel", "lien-securise", "workspace", "rattachement-manuel", "acces-candidat"] }),
    step("unassigned-cases", "relational-cases-without-workspace", "Dossiers sans Workspace", "Ces dossiers existent déjà mais ne sont rattachés à aucun espace de travail.", { glossary: ["dossier-sans-workspace", "workspace"] }),
    step("unassigned-first-case", "first-unassigned-relational-case", "Premier dossier à organiser", "Cette première ligne réelle présente un dossier existant à organiser, sans exposer son contenu privé dans la Boussole.", { glossary: ["dossier-sans-workspace", "dossier-relationnel"] }),
    step("unassigned-select-case", "select-workspace-for-relational-case", "Choisir le Workspace du dossier", "Choisissez le Workspace correspondant au contexte de ce dossier. Aucun effet n’est produit avant confirmation.", { glossary: ["workspace", "rattachement-manuel"] }),
    step("unassigned-attach-case", "attach-relational-case-to-workspace", "Confirmer le rattachement", "Cette action change uniquement le rattachement organisationnel et conserve le dossier et ses accès existants.", { glossary: ["rattachement-manuel", "acces-candidat", "validation-humaine"] }),
    step("unassigned-no-cases", "no-unassigned-relational-cases", "Tous les dossiers sont organisés", "Tous les dossiers relationnels visibles sont déjà rattachés à un Workspace.", { glossary: ["dossier-relationnel", "workspace"] }),
  ] },
];
export const governanceSteps = governanceSequences.flatMap(sequence => sequence.steps);
