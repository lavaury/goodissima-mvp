import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

type Options = { glossary?: string[]; states?: string[] };
const step = (id: string, targetId: string, title: string, body: string, options: Options = {}): CompassStep => ({
  id, targetId, title, body, detailedBody: body, targetStates: options.states,
  glossaryTermIds: options.glossary ?? [],
  animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true },
});

export const dossierSequences: BoussoleSequence[] = [
  { id: "understand-secure-case", title: "Comprendre ce dossier sécurisé", description: "Voir ce qui est créé après une réponse ou une mise en relation acceptée.", steps: [
    step("case-overview", "case-relational-overview", "Espace relationnel sécurisé", "Ce dossier réel devient l’espace de travail commun après une réponse admise ou une mise en relation acceptée. Il rassemble la conversation, les documents, les demandes, la gouvernance et les communications dans le même contexte.", { glossary: ["dossier", "dossier-relationnel", "communication-securisee"] }),
    step("case-navigation", "case-relational-navigation", "Les zones du dossier", "Ces repères annoncent les fonctions disponibles dans ce dossier. Ils ne changent pas de zone et ne déclenchent aucune action.", { glossary: ["dossier-relationnel", "gouvernance"] }),
  ] },
  { id: "secure-conversation", title: "Utiliser la conversation sécurisée", description: "Comprendre l’échange fondamental entre les participants du dossier.", steps: [
    step("case-conversation-zone", "case-conversation", "Conversation du dossier", "La conversation est rattachée à ce dossier et à ses participants autorisés. Les messages sont horodatés et restent dans ce contexte relationnel.", { glossary: ["communication-securisee", "dossier-relationnel", "participant"] }),
    step("case-message-history", "case-message-history", "Historique des messages", "Cette zone affiche les messages réellement échangés, leur auteur et leur date. Aucun message n’est produit ou envoyé automatiquement par la Boussole.", { glossary: ["communication-securisee", "validation-humaine"] }),
    step("case-message-composer", "case-message-composer", "Écrire ou dicter une réponse", "Saisissez votre message ou utilisez la dictée pour préparer le texte. La dictée remplit l’éditeur : elle n’envoie rien.", { glossary: ["communication-securisee", "validation-humaine"] }),
    step("case-send-message", "case-send-message", "Envoyer volontairement", "Seul votre clic sur Envoyer, ou votre validation explicite au clavier, transmet le message aux participants autorisés du dossier. Montrer la zone ne clique jamais.", { glossary: ["communication-securisee", "validation-humaine"] }),
  ] },
  { id: "case-documents", title: "Partager des documents", description: "Relier les pièces à la même conversation sécurisée.", steps: [
    step("case-documents-list", "case-documents", "Documents du dossier", "Les documents partagés restent rattachés au même dossier sécurisé que la conversation et sont accessibles selon les droits du contexte.", { glossary: ["document-attendu", "dossier-relationnel", "perimetre-d-acces"] }),
    step("case-document-upload", "case-document-upload", "Ajouter un document", "L’ajout exige une sélection volontaire du fichier. La Boussole n’ouvre pas le sélecteur et ne téléverse rien.", { glossary: ["validation-humaine", "perimetre-d-acces"] }),
  ] },
  { id: "case-secure-communications", title: "Appels et communications sécurisés", description: "Comprendre la salle, les médias et leur historique.", steps: [
    step("case-media-room", "case-secure-media-room", "Salle sécurisée du dossier", "Cette salle permet aux participants autorisés de se retrouver dans le contexte du dossier. Rejoindre exige un clic explicite et ne démarre encore aucun média.", { glossary: ["communication-securisee", "acces-candidat"] }),
    step("case-join-room", "join-secure-communication", "Rejoindre la salle", "Ce bouton établit la connexion à la salle sécurisée. Montrer la zone ne clique pas et ne demande aucun accès.", { glossary: ["communication-securisee", "validation-humaine"] }),
    step("case-media-controls", "case-secure-media-controls", "Audio, vidéo et partage d’écran", "Après connexion, chaque participant active séparément son microphone, sa caméra ou le partage d’écran. Aucun enregistrement ni transcription ne démarre automatiquement.", { glossary: ["communication-securisee", "validation-humaine"] }),
    step("case-communication-history", "case-communication-history", "Historique des communications", "Cette zone conserve les sessions et leurs statuts, sans enregistrer le contenu audio ou vidéo et sans transcription automatique.", { glossary: ["communication-securisee"] }),
  ] },
  { id: "case-access-matching", title: "Accès et matching du dossier", description: "Comprendre les contrôles sensibles qui complètent la relation.", steps: [
    step("case-matching", "candidate-case-matching", "Matching du dossier", "Le matching utilise les informations réellement fournies dans ce dossier. Son activation et l’examen de ses résultats restent humains et ne créent aucun contact automatiquement.", { glossary: ["matching-relationnel", "validation-humaine"] }),
    step("case-candidate-access", "candidate-access-controls", "Accès limité du candidat", "Cet accès permet à la personne autorisée de retrouver ce dossier et sa conversation dans un périmètre limité. Toute modification ou révocation exige une action humaine explicite.", { glossary: ["acces-candidat", "perimetre-d-acces", "validation-humaine"] }),
    step("case-regenerate-access", "regenerate-candidate-access", "Régénérer un accès", "Cette action sensible remplace l’accès candidat existant. La Boussole montre uniquement la zone et ne régénère jamais de lien.", { glossary: ["acces-candidat", "validation-humaine"] }),
  ] },
];

export const dossierSteps = dossierSequences.flatMap((sequence) => sequence.steps);
