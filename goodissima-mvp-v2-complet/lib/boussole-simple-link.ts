import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

type StepOptions = { glossary?: string[]; states?: string[]; durationMs?: number; focus?: "outline" | "spotlight" | "zoom"; narration?: string };
const s = (id: string, targetId: string, title: string, body: string, options: StepOptions = {}): CompassStep => ({
  id, targetId, title, body, detailedBody: body, glossaryTermIds: options.glossary ?? [], targetStates: options.states,
  animation: { focus: options.focus ?? "outline", movement: "scroll-center", narration: options.narration ?? body, subtitles: body, duration: Math.round((options.durationMs ?? 7000) / 1000), transition: "soft-focus", tryNow: true },
});

export const simpleLinkSequences: BoussoleSequence[] = [
  { id: "start", title: "Commencer", description: "Choisir un modèle, partir de zéro ou demander une proposition de champs.", steps: [
    s("simple-link-template-library", "choose-simple-link-template", "Partir d’un modèle", "Vous pouvez commencer avec un formulaire préparé. Un modèle évite la page blanche et tous ses champs restent modifiables. Cliquez sur « Choisir un modèle » pour parcourir la bibliothèque officielle. Importer un modèle ne crée et ne publie pas le lien.", { glossary: ["modele", "lien-simple"], states: ["not-imported"] }),
    s("simple-link-template-search", "search-simple-link-template", "Rechercher un modèle", "Recherchez un besoin courant dans la bibliothèque ouverte.", { glossary: ["modele"] }),
    s("simple-link-template-filter", "filter-simple-link-template", "Filtrer les modèles", "Les catégories réduisent la liste aux modèles adaptés.", { glossary: ["modele"] }),
    s("simple-link-template-use", "use-simple-link-template", "Utiliser un modèle", "Importer ce modèle remplit le constructeur sans créer le lien.", { glossary: ["modele", "validation-humaine"] }),
    s("simple-link-without-template", "create-without-template", "Créer sans modèle", "Choisissez cette option si vous préférez construire vous-même la liste des informations à demander.", { glossary: ["lien-simple"], states: ["not-imported"] }),
    s("simple-link-ai", "suggest-fields-with-ai", "Proposer des champs avec l’IA", "Vous pouvez demander à l’IA une première proposition de champs. Décrivez votre besoin en une phrase. L’IA proposera une courte liste de champs adaptés. Examinez ensuite chaque champ : vous pouvez le modifier, le supprimer ou l’ignorer. L’IA ne crée pas le lien, ne le publie pas et ne prend aucune décision à votre place.", { glossary: ["intelligence-artificielle", "champ", "validation-humaine"], narration: "Vous pouvez aussi décrire votre besoin à l’intelligence artificielle. Elle proposera des champs que vous garderez entièrement libres de modifier ou d’ignorer." }),
    s("simple-link-governance", "simple-link-governance-reminder", "Différence avec Gouvernance", "Pour plusieurs participants, des revues ou un pilotage structuré, ouvrez Gouvernance.", { glossary: ["lien-simple", "parcours-gouverne"] }),
  ]},
  { id: "define-link", title: "Définir le lien", description: "Présenter clairement le besoin et observer son rendu.", steps: [
    s("simple-link-set-title", "simple-link-title", "Donner un titre", "Saisissez un titre court qui permet de reconnaître immédiatement le besoin.", { glossary: ["lien-simple"] }),
    s("simple-link-set-description", "simple-link-description", "Ajouter une description", "Présentez le contexte sans surcharger le formulaire.", { glossary: ["formulaire"] }),
    s("simple-link-set-welcome", "simple-link-welcome-message", "Message d’accueil", "Ce message sera affiché à la personne qui ouvre le lien.", { glossary: ["formulaire"] }),
    s("simple-link-observe-preview", "simple-link-live-preview", "Observer l’aperçu", "L’aperçu reflète immédiatement le formulaire public en préparation.", { glossary: ["apercu", "formulaire", "lien-securise"], focus: "spotlight" }),
  ]},
  { id: "build-form", title: "Construire le formulaire", description: "Configurer uniquement les informations nécessaires.", steps: [
    s("simple-link-fields-understand", "simple-link-fields", "Comprendre les champs", "Chaque ligne correspond à une information demandée.", { glossary: ["champ", "formulaire"] }),
    s("simple-link-field-label", "simple-link-field-label", "Modifier un libellé", "Indiquez clairement l’information attendue.", { glossary: ["champ"] }),
    s("simple-link-field-type", "simple-link-field-type", "Choisir le type", "Le type détermine la manière dont la réponse sera saisie.", { glossary: ["type-de-champ"] }),
    s("simple-link-field-required", "simple-link-field-required", "Rendre obligatoire", "Activez cette option seulement lorsque la réponse est indispensable.", { glossary: ["champ-obligatoire"] }),
    s("simple-link-add-field", "add-simple-link-field", "Ajouter un champ", "Ajoutez uniquement les informations réellement nécessaires.", { glossary: ["champ"] }),
    s("simple-link-add-section", "add-simple-link-section", "Organiser avec une section", "Vous organisez la présentation de votre formulaire. Une section sert à regrouper plusieurs champs sous un même titre. Par exemple, vous pouvez créer une section « Coordonnées » contenant Nom, Email et Téléphone, puis une section « Votre recherche » contenant Ville, Budget et Surface. Ajoutez une section lorsque votre formulaire contient plusieurs groupes d’informations. Une section n’est pas une question et ne collecte aucune réponse. Elle sert uniquement à rendre le formulaire plus clair.", { glossary: ["section-de-formulaire", "champ", "formulaire"], narration: "Une section permet de regrouper plusieurs questions sous un titre commun. Par exemple, les coordonnées d’un côté et les critères de recherche de l’autre." }),
    s("simple-link-duplicate-field", "duplicate-simple-link-field", "Dupliquer un champ", "Dupliquez le premier champ visible pour préparer une variante proche.", { glossary: ["champ"] }),
    s("simple-link-reorder-field", "reorder-simple-link-field", "Réordonner les champs", "Placez les questions dans un ordre naturel pour la personne qui répond.", { glossary: ["champ"] }),
    s("simple-link-delete-field", "delete-simple-link-field", "Supprimer un champ", "Retirez les informations inutiles pour garder le formulaire simple.", { glossary: ["champ"] }),
  ]},
  { id: "add-rules", title: "Ajouter des règles", description: "Préciser et relire les critères du formulaire.", steps: [
    s("simple-link-add-rule", "add-simple-link-rule", "Ajouter une règle", "Ajoutez un critère uniquement à un champ compatible.", { glossary: ["regle", "critere"] }),
    s("simple-link-rule-operator", "simple-link-rule-operator", "Choisir l’opérateur", "Choisissez la comparaison adaptée au critère.", { glossary: ["regle", "critere"] }),
    s("simple-link-rule-value", "simple-link-rule-value", "Saisir la valeur", "Renseignez la valeur attendue pour cette comparaison.", { glossary: ["critere"] }),
    s("simple-link-rule-mode", "simple-link-rule-mode", "Indicative ou bloquante", "Choisissez si un écart doit être signalé ou empêcher l’envoi.", { glossary: ["regle-indicative", "regle-bloquante"] }),
    s("simple-link-rule-summary", "simple-link-rule-summary", "Lire la règle", "Relisez la reformulation avant de poursuivre.", { glossary: ["regle", "ecart-a-examiner"] }),
    s("simple-link-rule-preview", "simple-link-live-preview", "Vérifier l’aperçu", "Contrôlez la façon dont le critère apparaît dans le formulaire.", { glossary: ["apercu", "regle"] }),
  ]},
  { id: "configure-more", title: "Configurer davantage", description: "Ouvrir seulement les réglages complémentaires utiles.", steps: [
    s("simple-link-advanced", "simple-link-advanced-options", "Options avancées", "Vous êtes dans les réglages complémentaires du lien. Cette zone n’est pas nécessaire dans la majorité des créations simples. Ouvrez-la uniquement si vous devez ajuster un paramètre complémentaire ; sinon poursuivez vers la vérification."),
  ]},
  { id: "verify-create", title: "Vérifier et créer", description: "Contrôler le formulaire puis ouvrir le lien créé.", steps: [
    s("simple-link-final-check", "simple-link-final-check-section", "Dernière vérification", "Cette zone permet de vérifier le formulaire et de confirmer explicitement sa création. Relisez les champs et l’aperçu avant de confirmer.", { glossary: ["apercu", "validation-humaine"], states: ["unconfirmed", "confirmed"] }),
    s("simple-link-confirm", "confirm-simple-link", "Confirmer la création", "Cochez cette case uniquement après avoir vérifié les champs. Aucune diffusion ne sera faite automatiquement.", { glossary: ["validation-humaine"], states: ["unconfirmed", "confirmed"] }),
    s("simple-link-create-disabled", "create-simple-link", "Bouton désactivé", "Le bouton reste désactivé tant que la vérification humaine n’est pas confirmée.", { glossary: ["validation-humaine"], states: ["disabled"] }),
    s("simple-link-create", "create-simple-link", "Créer le lien", "Ce bouton crée le lien, puis ouvre son espace propriétaire. Vous pourrez y vérifier et copier le lien public ; aucun partage n’est automatique.", { glossary: ["publication", "validation-humaine"], states: ["ready"] }),
  ]},
];

export const simpleLinkSteps = simpleLinkSequences.flatMap((sequence) => sequence.steps);
