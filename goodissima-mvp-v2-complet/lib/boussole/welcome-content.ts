import type { WelcomeEntry, WelcomeMode } from "./welcome-contracts.ts";

export const welcomeGeneralContent = {
  title: "Bienvenue dans Goodissima",
  reassurance: "Vous n’avez pas besoin de tout connaître pour commencer. Vous gardez la maîtrise de chaque suite donnée.",
  shortDiscovery: "Découvrez l’essentiel de Goodissima en quelques étapes.",
  modes: {
    DISCOVER: "Je découvre Goodissima",
    DIRECT: "Je sais déjà ce que je veux faire",
    HELP: "J’ai besoin d’aide pour choisir",
  } satisfies Record<WelcomeMode, string>,
  exitLabels: {
    dashboard: "Passer la découverte et ouvrir le Dashboard",
    later: "Je découvrirai plus tard",
  },
  situation: [
    "Des échanges peuvent être dispersés entre plusieurs outils.",
    "Les documents et informations utiles peuvent être répartis.",
    "Des coordonnées peuvent être révélées avant que la suite soit décidée.",
    "Les processus impliquant plusieurs personnes peuvent être difficiles à suivre.",
  ],
  principle: "Goodissima part d’une intention, aide à recueillir des réponses, repère des rapprochements possibles et organise les suites, tout en conservant une décision humaine.",
  humanControl: [
    "Aucun contact n’est créé automatiquement.",
    "Aucune publication n’est automatique.",
    "Aucune relation n’est imposée.",
    "Aucune décision n’est prise automatiquement.",
    "Aucune invitation n’est envoyée automatiquement.",
  ],
  completion: {
    title: "Vous connaissez maintenant les principales manières de commencer.",
    contextualHandoff: "Sur la page choisie, la Boussole contextuelle pourra vous aider à comprendre les éléments réellement présents.",
    humanAction: "Aucune action ne sera déclenchée sans votre clic explicite.",
  },
} as const;

export const welcomeEntries: readonly WelcomeEntry[] = [
  {
    key: "SIMPLE_LINK",
    stableId: "welcome-entry-simple-link",
    title: "Recevoir des demandes",
    description: "Préparez un formulaire sécurisé, puis partagez son lien lorsque vous êtes prêt.",
    usageExample: "Recueillir des inscriptions, des candidatures ou des demandes de contact.",
    humanControlNotice: "Goodissima ne diffuse pas le lien et ne contacte personne automatiquement.",
    route: "/links/simple",
    targetContextId: "simple-link",
    targetJourneyId: "start",
    contextualGuidanceStatus: "AVAILABLE",
    sortOrder: 1,
  },
  {
    key: "OPPORTUNITY",
    stableId: "welcome-entry-opportunity",
    title: "Publier un besoin ou une proposition",
    description: "Préparez ce que vous recherchez ou proposez avant de décider de sa publication.",
    explanationOfGoodissimaTerm: "Goodissima appelle cela une opportunité.",
    usageExample: "Présenter un besoin de partenariat, une recherche ou une proposition de service.",
    humanControlNotice: "La proposition reste à relire et aucune publication n’est automatique.",
    route: "/opportunities/new",
    targetContextId: "opportunities",
    targetJourneyId: null,
    contextualGuidanceStatus: "NEEDS_DEDICATED_JOURNEY",
    sortOrder: 2,
  },
  {
    key: "GOVERNED_JOURNEY",
    stableId: "welcome-entry-governed-journey",
    title: "Organiser un processus à plusieurs",
    description: "Structurez les personnes, les étapes, les documents et les décisions à suivre.",
    explanationOfGoodissimaTerm: "Goodissima appelle ce cadre un parcours gouverné.",
    usageExample: "Coordonner un projet nécessitant plusieurs responsabilités et validations.",
    humanControlNotice: "Aucun participant n’est invité et aucun processus ne démarre automatiquement.",
    route: "/gouvernance/nouveau",
    targetContextId: "new-governed-journey",
    targetJourneyId: "choose-governed-format",
    contextualGuidanceStatus: "AVAILABLE",
    sortOrder: 3,
  },
  {
    key: "EXISTING_ACTIVITY",
    stableId: "welcome-entry-existing-activity",
    title: "Retrouver et piloter mon activité",
    description: "Retrouvez vos liens, opportunités, parcours et événements récents depuis votre vue d’ensemble.",
    usageExample: "Reprendre une activité existante et ouvrir les éléments qui demandent votre attention.",
    humanControlNotice: "Les indicateurs vous orientent, mais ils ne choisissent ni ne traitent vos priorités automatiquement.",
    route: "/dashboard",
    targetContextId: "dashboard",
    targetJourneyId: "repères",
    contextualGuidanceStatus: "AVAILABLE",
    sortOrder: 4,
  },
] as const;

export function getWelcomeEntry(key: WelcomeEntry["key"]): WelcomeEntry {
  const entry = welcomeEntries.find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`Unknown welcome entry: ${key}`);
  return entry;
}
