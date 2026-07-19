import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

type Options = { glossary?: string[]; narration?: string; focus?: "outline" | "spotlight" | "zoom" };
const step = (id: string, targetId: string, title: string, body: string, options: Options = {}): CompassStep => ({
  id, targetId, title, body, detailedBody: body, glossaryTermIds: options.glossary ?? [],
  animation: { focus: options.focus ?? "outline", movement: "scroll-center", narration: options.narration ?? body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true },
});

export const governanceSequences: BoussoleSequence[] = [
  { id: "understand-governance", title: "Comprendre Gouvernance", description: "Comprendre la mission de cette page et sa différence avec un lien simple.", steps: [
    step("governance-page", "governance-overview", "L’espace Gouvernance", "Cette page rassemble les parcours et les espaces nécessitant une gouvernance structurée.", { glossary: ["gouvernance", "parcours-gouverne"] }),
    step("governance-simple-link", "governance-simple-link-difference", "Différence avec Lien simple", "Utilisez un lien simple pour collecter rapidement des informations. Utilisez un parcours gouverné lorsque plusieurs acteurs, responsabilités, revues ou un pilotage sont nécessaires. Le parcours gouverné est créé ici, dans Gouvernance.", { glossary: ["lien-simple", "parcours-gouverne", "gouvernance"] }),
    step("governance-human", "governance-human-control-notice", "Gouvernance humaine", "Goodissima peut préparer des éléments, mais aucune décision, invitation ou revue n’est conduite automatiquement.", { glossary: ["gouvernance", "validation-humaine", "conduite-humaine"] }),
  ] },
  { id: "governance-summary", title: "Lire la synthèse", description: "Lire les indicateurs réellement disponibles et l’état vide.", steps: [
    step("governance-workspace-count", "governance-workspaces-count", "Workspaces visibles", "Cet indicateur montre le nombre de Workspaces visibles. Ils regroupent les parcours, liens, dossiers et relations d’un même contexte.", { glossary: ["workspace", "contexte-de-travail"] }),
    step("governance-empty", "governance-empty-state", "Aucun Workspace", "Aucun Workspace n’est encore présent. Vous pouvez commencer par créer un parcours gouverné ou un Workspace, sans contenu fictif.", { glossary: ["workspace", "parcours-gouverne"] }),
  ] },
  { id: "create-governed", title: "Créer un parcours gouverné", description: "Comprendre quand utiliser le constructeur de parcours.", steps: [
    step("governance-create", "create-governed-journey", "Créer un parcours gouverné", "Cette action ouvre le constructeur. Un parcours structure un besoin, ses participants, ses étapes et ses décisions. Il n’est ni envoyé ni partagé automatiquement.", { glossary: ["parcours-gouverne", "participant", "etape-de-parcours"] }),
    step("governance-when", "create-governed-journey", "Comprendre quand l’utiliser", "Utilisez un parcours gouverné lorsqu’un simple formulaire ne suffit pas : plusieurs acteurs, invitations, documents, revues ou communication structurée.", { glossary: ["parcours-gouverne", "lien-simple"] }),
    step("governance-validation", "governance-create-human-validation", "Validation humaine", "Une proposition de parcours doit toujours être examinée et validée avant sa création.", { glossary: ["validation-humaine", "parcours-gouverne"] }),
  ] },
  { id: "understand-workspaces", title: "Organiser mes espaces", description: "Distinguer Workspaces, Portfolios et Annuaire, puis utiliser leurs accès réels.", steps: [
    step("governance-workspaces", "governance-workspaces-section", "Zone Workspaces", "Un Workspace rassemble les objets liés à un même contexte de travail.", { glossary: ["workspace", "contexte-de-travail"] }),
    step("governance-create-workspace", "create-workspace", "Créer un Workspace", "Créez un Workspace pour organiser plusieurs parcours, dossiers, liens ou relations. Sa création ne déclenche aucune action sur ces objets.", { glossary: ["workspace", "rattachement", "validation-humaine"] }),
    step("governance-workspace-portfolio", "governance-workspace-portfolio-explanation", "Workspace ou Portfolio ?", "Un Workspace organise les parcours, liens, dossiers et communications d’un même contexte. Un Portfolio regroupe plusieurs Workspaces dans une vue produit, métier ou organisationnelle. Créer un Portfolio ne crée aucun dossier et ne lance aucune action.", { glossary: ["workspace", "portfolio", "rattachement", "contexte-de-travail"] }),
    step("governance-portfolio-card", "create-portfolio-card", "Créer un Portfolio", "Cette carte permet de préparer un regroupement de plusieurs Workspaces. La création ne crée aucun dossier, ne contacte personne et ne lance aucune action.", { glossary: ["portfolio", "workspace", "validation-humaine"] }),
    step("governance-create-portfolio", "create-portfolio", "Ouvrir la création du Portfolio", "Cette action ouvre le formulaire de création. La Boussole montre uniquement la zone et ne crée rien automatiquement.", { glossary: ["portfolio", "validation-humaine"] }),
    step("governance-open-portfolios", "open-portfolios", "Consulter mes Portfolios", "Cette page présente les Portfolios qui regroupent vos Workspaces. Un Portfolio organise des espaces existants et ne remplace pas le Workspace.", { glossary: ["portfolio", "workspace"] }),
    step("governance-directory-card", "governance-directory-card", "Annuaire Goodissima V1", "Cette carte donne accès à l’espace transversal d’identité, de confiance et de préparation humaine des contacts. Consulter l’Annuaire ne contacte personne et n’ouvre aucun accès.", { glossary: ["annuaire-goodissima", "identite", "confiance", "contact", "validation-humaine"] }),
    step("governance-open-directory", "open-goodissima-directory", "Ouvrir l’Annuaire", "Ouvrez l’Annuaire pour consulter les informations disponibles et les actions autorisées. Aucun message, relation ou accès n’est créé automatiquement.", { glossary: ["annuaire-goodissima", "validation-humaine"] }),
    step("governance-workspace-card", "governance-first-workspace", "Lire une carte Workspace", "Cette première carte réelle présente un espace de travail existant et les objets qui lui sont rattachés.", { glossary: ["workspace", "rattachement"] }),
    step("governance-workspace-category", "workspace-category", "Catégorie du Workspace", "La catégorie et le type aident à comprendre le contexte réel de cet espace.", { glossary: ["workspace", "contexte-de-travail"] }),
    step("governance-workspace-objects", "workspace-object-counts", "Contenu du Workspace", "Ces compteurs montrent combien de parcours, relations, liens, communications et autres objets sont rattachés à cet espace.", { glossary: ["workspace", "rattachement", "cockpit-consolide"] }),
  ] },
  { id: "organize-unassigned", title: "Organiser les éléments sans Workspace", description: "Comprendre le rattachement manuel d’objets qui existent déjà.", steps: [
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
  { id: "read-governed-journey", title: "Lire et ouvrir un parcours", description: "Utiliser le premier parcours gouverné réel visible.", steps: [
    step("governance-journey", "governance-first-journey", "Identifier le parcours", "Cette carte représente un parcours gouverné réel rattaché à un Workspace.", { glossary: ["parcours-gouverne"] }),
    step("governance-journey-title", "governed-journey-title", "Titre du parcours", "Le titre indique la situation organisée par ce parcours.", { glossary: ["parcours-gouverne"] }),
    step("governance-journey-workspace", "governed-journey-workspace", "Workspace associé", "Ce parcours est organisé dans le Workspace indiqué.", { glossary: ["workspace", "rattachement"] }),
    step("governance-open-journey", "open-governed-journey", "Ouvrir le parcours", "Ouvrez le cockpit pour consulter les participants, les étapes, les invitations, les revues et le pilotage de ce parcours. La Boussole ne l’ouvre pas à votre place.", { glossary: ["parcours-gouverne", "cockpit-consolide", "validation-humaine"] }),
  ] },
  { id: "governance-pilotage", title: "Accéder au pilotage", description: "Distinguer la Salle globale du cockpit d’un parcours.", steps: [
    step("governance-global-pilotage", "open-global-governance-pilotage", "Pilotage global", "La Salle de pilotage consolide les parcours, revues et signaux nécessitant votre attention. Elle ne déclenche aucune action automatiquement.", { glossary: ["pilotage-global", "salle-pilotage", "signal"] }),
    step("governance-journey-pilotage", "open-governed-journey", "Pilotage d’un parcours", "Le cockpit d’un parcours permet d’examiner son état, ses participants, ses revues et ses prochaines décisions.", { glossary: ["pilotage-de-parcours", "parcours-gouverne"] }),
    step("governance-pilotage-difference", "governance-pilotage-explanation", "Deux niveaux de pilotage", "La Salle de pilotage globale rassemble les signaux transversaux. Le pilotage du parcours concerne uniquement ce parcours gouverné.", { glossary: ["pilotage-global", "pilotage-de-parcours", "salle-pilotage"] }),
  ] },
];

export const governanceSteps = governanceSequences.flatMap((sequence) => sequence.steps);
