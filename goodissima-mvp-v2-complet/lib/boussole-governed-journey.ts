import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

type Options = { glossary?: string[]; states?: string[] };
const step = (id: string, targetId: string, title: string, body: string, options: Options = {}): CompassStep => ({
  id, targetId, title, body, detailedBody: body, targetStates: options.states,
  glossaryTermIds: options.glossary ?? [],
  animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true },
});

export const governedJourneySequences: BoussoleSequence[] = [
  { id: "discover-governed-journey", title: "Découvrir ce parcours gouverné", description: "Comprendre le cadrage réel, le Workspace, la synthèse et les compteurs.", steps: [
    step("real-journey-overview", "governed-journey-overview", "Comprendre ce parcours", "Cette zone présente le parcours réel et son objectif validé. La Boussole ne modifie ni son statut ni son contenu.", { glossary: ["parcours-gouverne", "objectif", "validation-humaine"] }),
    step("real-journey-need", "governed-journey-initial-need", "Besoin initial validé", "Ce besoin explique pourquoi le parcours existe. Il constitue un repère de lecture et ne déclenche aucune action.", { glossary: ["objectif", "contexte"] }),
    step("real-journey-workspace", "governed-journey-workspace", "Workspace actuel", "Le Workspace rattache le parcours à son contexte de travail actuel. La visite ne change jamais ce rattachement.", { glossary: ["workspace", "rattachement-manuel"] }),
    step("real-journey-summary", "governed-journey-summary", "Vue synthétique", "La synthèse rassemble les états déclarés du parcours et ses compteurs. Ils orientent la lecture sans décider d’une priorité à votre place.", { glossary: ["cockpit-consolide", "signal"] }),
    step("real-journey-consolidation", "governed-journey-consolidation", "Vue consolidée", "Cette zone montre les objets réellement rattachés au Workspace. Ouvrir la visite ne contacte personne et ne lance aucun workflow.", { glossary: ["workspace", "cockpit-consolide"] }),
  ] },
  { id: "human-interventions", title: "Voir les interventions humaines", description: "Commencer par les situations réellement en attente dans ce parcours.", steps: [
    step("real-human-interventions", "governed-journey-human-interventions", "Interventions humaines", "Cette zone regroupe les signaux déterministes réellement présents. Chaque signal demande une lecture et une action humaines ; la Boussole ne le traite jamais.", { states: ["pending"], glossary: ["signal", "validation-humaine"] }),
    step("real-first-human-intervention", "governed-journey-human-intervention", "Première intervention en attente", "Examinez la première situation visible : invitation à transmettre, document à revoir, revue à conduire, communication à vérifier ou dossier à ouvrir. Montrer la zone ne suit pas le lien.", { glossary: ["signal", "responsabilite"] }),
    step("real-no-human-intervention", "governed-journey-human-interventions", "Aucune intervention en attente", "Aucun signal consolidé n’est actuellement présent. Cette absence est un état de lecture, pas une validation automatique du parcours.", { states: ["empty"], glossary: ["signal", "validation-humaine"] }),
  ] },
  { id: "participants-access", title: "Participants, invitations et accès", description: "Lire les responsabilités et les accès réellement préparés.", steps: [
    step("real-organizer", "governed-journey-organizer", "Organisateur", "L’organisateur pilote le parcours depuis son compte Goodissima. La visite ne crée aucun accès invité.", { glossary: ["responsabilite", "acces-gouverne"] }),
    step("real-participants", "governed-journey-participants", "Participants attendus", "Cette section présente les participants réellement attendus et leurs responsabilités. Aucun message n’est transmis automatiquement.", { glossary: ["participant", "responsabilite"] }),
    step("real-prepared-invitation", "governed-journey-participant", "Invitation préparée", "Le premier participant correspondant possède une invitation préparée et un message à transmettre manuellement. La Boussole ne copie, n’envoie et n’ouvre aucun accès.", { states: ["invitation-prepared"], glossary: ["invitation-privee", "acces-gouverne"] }),
    step("real-expected-participant", "governed-journey-participant", "Participant sans invitation préparée", "Ce participant est attendu, mais aucune invitation n’est préparée. Toute préparation ou création d’accès exige une action humaine explicite.", { states: ["expected"], glossary: ["participant", "invitation-privee"] }),
    step("real-guest-access", "governed-journey-guest-access", "Accès invité gouverné", "Chaque participant externe reçoit un lien personnel différent, limité dans le temps. Ce lien lui permet de rejoindre la réunion dans son propre périmètre : il doit être transmis manuellement au bon participant et ne doit jamais être partagé entre participants. La Boussole ne crée ni ne copie ce lien.", { glossary: ["acces-gouverne", "invitation-privee", "perimetre-d-acces"] }),
  ] },
  { id: "documents-actions", title: "Documents et premières actions", description: "Comprendre les attentes documentaires et les actions restant humaines.", steps: [
    step("real-documents", "governed-journey-documents", "Documents attendus", "Cette section liste les documents réellement attendus. En V1, une réception peut être déclarée sans fichier stocké.", { glossary: ["document-attendu", "validation-humaine"] }),
    step("real-received-document", "governed-journey-document", "Réception déclarée", "La réception du premier document correspondant a été déclarée. Elle ne constitue ni un stockage de fichier ni une validation automatique.", { states: ["received"], glossary: ["document-attendu", "validation-humaine"] }),
    step("real-pending-document", "governed-journey-document", "Document restant attendu", "Ce document reste attendu. Sa réception et son examen devront être déclarés par une personne.", { states: ["pending"], glossary: ["document-attendu", "responsabilite"] }),
    step("real-first-actions", "governed-journey-first-actions", "Premières actions", "Ces actions sont à démarrer humainement. La Boussole ne change aucun statut et ne lance aucun workflow.", { glossary: ["etape-de-parcours", "validation-humaine"] }),
  ] },
  { id: "governed-communications", title: "Communications gouvernées", description: "Lire les états réels et le périmètre des participants autorisés.", steps: [
    step("real-communications", "governed-communications", "Communications gouvernées", "Cette section rassemble les communications préparées, actives, terminées, annulées ou expirées. Aucun média, enregistrement ou transcription ne démarre automatiquement.", { glossary: ["communication-securisee", "validation-humaine"] }),
    step("real-secure-communication", "governed-journey-secure-communication", "Communication sécurisée du parcours", "Cette salle est le point de réunion sécurisé du parcours. L’organisateur la rejoint depuis son compte ; chaque invité gouverné la rejoint avec son propre lien personnel. Rien ne démarre avant l’action explicite de chacun.", { glossary: ["communication-securisee", "acces-gouverne"] }),
    step("real-first-communication", "governed-journey-communication", "Réunion préparée ou planifiée", "Cette première carte réelle décrit une réunion préparée, éventuellement planifiée avec une date, son état et son périmètre. Préparer organise la réunion sans la démarrer, sans prévenir les participants et sans ouvrir leurs médias.", { glossary: ["communication-securisee", "validation-humaine"] }),
    step("real-meeting-room", "governed-journey-media-room", "Rejoindre la réunion", "Le bouton Rejoindre établit la connexion uniquement après un clic humain. Montrer la zone ne clique pas et ne demande aucun jeton de connexion.", { glossary: ["communication-securisee", "validation-humaine"] }),
    step("real-meeting-participants", "governed-journey-meeting-participants", "Participants autorisés", "Cette zone distingue les personnes présentes et attendues. Chaque invité autorisé conserve son accès personnel ; l’accès d’un participant ne doit pas servir à un autre.", { glossary: ["participant", "acces-gouverne", "perimetre-d-acces"] }),
    step("real-media-controls", "governed-journey-media-controls", "Audio, vidéo et partage d’écran", "Une fois la salle rejointe, chaque personne active séparément son microphone, sa caméra ou le partage d’écran. Aucun média, enregistrement ou transcription ne s’active automatiquement.", { glossary: ["communication-securisee", "validation-humaine"] }),
  ] },
  { id: "governance-review", title: "Revue de gouvernance", description: "Comprendre la préparation, l’assistance facultative et la conduite humaine.", steps: [
    step("real-reviews", "governance-reviews", "Revues de gouvernance", "Cette section rassemble les revues réelles du parcours et permet d’en préparer une. Aucune revue, réunion ou décision n’est automatique.", { glossary: ["revue", "validation-humaine"] }),
    step("real-prepared-review", "open-governance-review", "Revue préparée", "Cette carte présente le motif et la question à trancher. L’assistant est facultatif et ne reçoit des données que si vous le sollicitez ; la conduite et la décision restent humaines.", { glossary: ["revue", "conduite-humaine", "validation-humaine"] }),
    step("real-prepare-review", "prepare-governance-review", "Préparer une revue", "La préparation enregistre un cadrage à relire. La Boussole ne remplit pas le formulaire, ne déclenche pas l’assistant et ne lance aucune action.", { glossary: ["revue", "validation-humaine"] }),
    step("real-v1-limits", "governed-journey-v1-limits", "Limites V1", "La V1 ne crée aucune réunion, notification, synthèse, décision, invitation ou communication automatiquement.", { glossary: ["conduite-humaine", "validation-humaine"] }),
  ] },
];

export const governedJourneySteps = governedJourneySequences.flatMap((sequence) => sequence.steps);
