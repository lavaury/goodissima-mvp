import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

type StepOptions = { glossary?: string[]; states?: string[]; narration?: string; focus?: "outline" | "spotlight" | "zoom" };

const step = (id: string, targetId: string, title: string, body: string, options: StepOptions = {}): CompassStep => ({
  id,
  targetId,
  title,
  body,
  detailedBody: body,
  targetStates: options.states,
  glossaryTermIds: options.glossary ?? [],
  animation: {
    focus: options.focus ?? "outline",
    movement: "scroll-center",
    narration: options.narration ?? body,
    subtitles: body,
    duration: 7,
    transition: "soft-focus",
    tryNow: true,
  },
});

export const opportunitySequences: BoussoleSequence[] = [
  { id: "discover-opportunities", title: "Découvrir les opportunités", description: "Comprendre la mission de la page et les objets qu’elle présente.", steps: [
    step("opportunities-page", "opportunities-overview", "La page Opportunités", "Cette page regroupe les besoins, offres et annonces enregistrés dans votre environnement Goodissima.", { glossary: ["opportunite", "annonce"] }),
    step("opportunities-objects", "opportunities-list", "Opportunité, annonce et lien", "Une opportunité représente un besoin ou une offre. Elle peut être publiée sous forme d’annonce et accessible à l’aide d’un lien sécurisé. Un dossier n’est créé que lorsqu’une personne répond effectivement au lien.", { glossary: ["opportunite", "annonce", "lien-securise", "dossier"] }),
    step("opportunities-create", "create-opportunity", "Créer une opportunité", "Cette action permet de créer un nouveau besoin ou une nouvelle offre. Elle ne publie et ne diffuse rien automatiquement.", { glossary: ["opportunite", "annonce", "validation-humaine"] }),
    step("opportunities-summary", "opportunities-summary", "Synthèse de la page", "Cette synthèse vous aide à repérer les opportunités actives et celles qui demandent une intervention.", { glossary: ["statut", "cycle-de-vie"] }),
  ] },
  { id: "filter-opportunities", title: "Rechercher et filtrer", description: "Utiliser les vues réellement disponibles sur cette page.", steps: [
    step("opportunities-active", "opportunities-filter-active", "Annonces actives", "Cette vue affiche les opportunités non archivées. Une opportunité active peut encore recevoir des réponses ou faire l’objet d’un suivi.", { glossary: ["opportunite", "statut"] }),
    step("opportunities-archived", "opportunities-filter-archived", "Archivées", "Les opportunités archivées sont retirées de la vue active sans être présentées comme supprimées.", { glossary: ["archivage"] }),
  ] },
  { id: "secure-link-to-conversation", title: "Du lien sécurisé à la conversation", description: "Comprendre comment une réponse réelle devient un dossier relationnel sécurisé.", steps: [
    step("secure-link-origin", "opportunity-card-public-link", "Lien sécurisé de l’opportunité", "Ce lien donne accès au formulaire associé à l’opportunité. Il doit être partagé volontairement et Goodissima ne l’envoie à personne automatiquement.", { glossary: ["lien-securise", "lien-public", "partage"] }),
    step("secure-link-admission", "opportunity-admission", "Admission avant création du dossier", "La règle d’admission détermine qui peut répondre : « Ouverte à tous » autorise une réponse sans identité Goodissima vérifiée, tandis que « Réservée aux personnes vérifiées » exige une identité Goodissima vérifiée. Un partage ou un affichage du lien ne crée automatiquement ni candidat, ni conversation, ni dossier. La Boussole explique ce réglage sans le modifier.", { glossary: ["admission", "identite-goodissima-verifiee", "candidat", "dossier"] }),
    step("secure-link-case-created", "opportunity-card-case-count", "Dossier créé après une réponse réelle", "Lorsqu’une réponse est admise, un dossier relationnel sécurisé est créé. Il rassemble ensuite la conversation, les documents, les demandes, la gouvernance et la salle sécurisée de cette relation.", { glossary: ["dossier", "dossier-relationnel", "communication-securisee"] }),
    step("secure-link-open-cases", "open-opportunity-cases", "Ouvrir les conversations", "Ouvrez les dossiers reçus pour accéder à leurs conversations réelles. La Boussole ne crée aucun dossier et n’envoie aucun message.", { glossary: ["dossier-relationnel", "communication-securisee", "validation-humaine"] }),
  ] },
  { id: "read-opportunity", title: "Lire une opportunité", description: "Lire la première carte réelle actuellement visible.", steps: [
    step("opportunity-title", "opportunity-card-title", "Identifier l’opportunité", "Le titre permet d’identifier rapidement le besoin ou l’offre.", { glossary: ["opportunite"] }),
    step("opportunity-status", "opportunity-card-status", "Lire son statut", "Le statut indique où se trouve l’opportunité dans son cycle de vie.", { glossary: ["statut", "cycle-de-vie"] }),
    step("opportunity-link", "opportunity-card-public-link", "Accéder au lien associé", "Ce lien permet d’accéder à l’annonce ou au formulaire public associé. Il doit être transmis volontairement : Goodissima ne le diffuse pas automatiquement.", { glossary: ["lien-public", "lien-securise", "annonce"] }),
    step("opportunity-cases", "opportunity-card-case-count", "Voir les dossiers reçus", "Cet indicateur montre combien de dossiers ont été créés à partir de cette opportunité. S’il indique « Aucun dossier », cette opportunité n’a pas encore reçu de réponse.", { glossary: ["dossier"] }),
    step("opportunity-admission", "opportunity-admission", "Comprendre l’admission", "L’admission détermine qui peut répondre au lien et créer un dossier. « Ouverte à tous » autorise une réponse sans identité Goodissima vérifiée. « Réservée aux personnes vérifiées » exige une identité Goodissima vérifiée avant la création d’un dossier. La Boussole explique ce réglage sans le modifier.", { glossary: ["admission", "identite-goodissima-verifiee", "dossier", "validation-humaine"] }),
  ] },
  { id: "understand-opportunity-matching", title: "Comprendre le matching", description: "Lire l’état réel du matching et ses limites humaines.", steps: [
    step("opportunity-matching", "opportunity-matching-status", "Zone matching", "Le matching compare les critères de cette opportunité avec d’autres besoins ou offres potentiellement compatibles.", { glossary: ["matching-relationnel", "matching-du-lien"] }),
    step("opportunity-matching-disabled", "opportunity-matching-status", "Matching désactivé", "Le matching n’est pas activé pour cette opportunité. Aucune comparaison n’est attendue.", { states: ["DISABLED"], glossary: ["matching-relationnel"] }),
    step("opportunity-matching-analyze", "opportunity-matching-status", "Matching à analyser", "Cette opportunité est candidate au matching, mais l’analyse doit encore être lancée ou examinée humainement.", { states: ["TO_ANALYZE"], glossary: ["matching-relationnel", "validation-humaine"] }),
    step("opportunity-matching-review", "opportunity-matching-status", "Correspondances à examiner", "Des correspondances potentielles ont été détectées. Elles doivent être examinées avant toute décision.", { states: ["MATCHES_TO_REVIEW"], glossary: ["correspondance-potentielle", "validation-humaine"] }),
    step("opportunity-matching-follow-up", "opportunity-matching-status", "Suite à décider", "Une correspondance a été retenue comme intéressante. La suite reste à décider humainement.", { states: ["FOLLOW_UP_TO_DECIDE"], glossary: ["suite-a-decider", "validation-humaine"] }),
    step("opportunity-matching-none", "opportunity-matching-status", "Aucun résultat exploitable", "Aucune correspondance exploitable n’a été trouvée. Vous pouvez éventuellement préciser les critères.", { states: ["NO_RESULTS"], glossary: ["matching-relationnel"] }),
    step("opportunity-open-matching", "open-opportunity-matching", "Ouvrir le matching", "Ouvrez cette zone pour analyser ou examiner les correspondances potentielles. Aucun contact, email, dossier ou relation n’est créé automatiquement.", { glossary: ["matching-relationnel", "correspondance-potentielle", "validation-humaine"] }),
  ] },
  { id: "act-on-opportunity", title: "Agir sur une opportunité", description: "Repérer les actions disponibles sans les déclencher.", steps: [
    step("opportunity-copy", "copy-opportunity-link", "Copier le lien", "Cette action copie le lien. Elle ne l’envoie à personne.", { glossary: ["lien-public", "partage"] }),
    step("opportunity-share", "share-opportunity", "Partager", "Cette action prépare un partage manuel ou utilise le partage natif du navigateur. Vérifiez toujours le destinataire et le contenu.", { glossary: ["partage", "validation-humaine"] }),
    step("opportunity-public", "view-public-opportunity", "Voir l’annonce publique", "Cette vue permet de vérifier ce que verra une personne qui ouvre le lien.", { glossary: ["annonce-publique", "lien-public"] }),
    step("opportunity-manage", "manage-opportunity", "Gérer l’opportunité", "Ouvrez la gestion pour modifier les informations autorisées ou consulter les paramètres de l’opportunité.", { glossary: ["opportunite"] }),
    step("opportunity-open-cases", "open-opportunity-cases", "Examiner les dossiers", "Les dossiers contiennent les réponses et échanges créés à partir de cette opportunité.", { glossary: ["dossier"] }),
    step("opportunity-archive", "archive-announcement", "Archiver", "L’archivage retire cette opportunité de la vue active sans supprimer son historique. Cette action reste volontaire.", { glossary: ["archivage", "validation-humaine"] }),
  ] },
  { id: "opportunity-lifecycle", title: "Comprendre le cycle de vie", description: "Distinguer les états réellement visibles dans cette page.", steps: [
    step("opportunity-active-status", "opportunity-status-active", "Active", "Une opportunité active peut encore recevoir des réponses et demander un suivi.", { glossary: ["statut", "cycle-de-vie"] }),
    step("opportunity-closed-status", "opportunity-status-closed", "Clôturée", "Une opportunité clôturée est considérée comme terminée pour le traitement actif.", { glossary: ["cloture", "cycle-de-vie"] }),
    step("opportunity-archived-status", "opportunity-status-archived", "Archivée", "Une opportunité archivée reste consultable dans l’historique, mais n’apparaît plus parmi les opportunités actives.", { glossary: ["archivage", "cycle-de-vie"] }),
    step("opportunity-open-archives", "open-archives", "Ouvrir les Archives", "Les Archives permettent de retrouver les opportunités retirées de la vue active.", { glossary: ["archivage"] }),
  ] },
];

export const opportunitySteps = opportunitySequences.flatMap((sequence) => sequence.steps);
