import type { CompassStep } from "./boussole-context.ts";

export type BoussoleSequence = { id: string; title: string; description: string; steps: CompassStep[] };

const step = (id: string, title: string, shortBody: string, detailedBody: string, duration = 7): CompassStep => ({
  id, title, body: shortBody, detailedBody, targetId: id, glossaryTermIds: dashboardGlossaryTermIds[id] ?? [],
  animation: { focus: id, movement: "scroll-center", narration: detailedBody, subtitles: shortBody, duration, transition: "soft-focus", tryNow: true },
});

const dashboardGlossaryTermIds: Record<string, string[]> = {
  "dashboard-menu": ["dashboard"], "dashboard-create-actions": ["lien-simple", "opportunite"], "dashboard-indicators": ["dashboard"],
  "dashboard-recent-activity": ["chronologie"], "dashboard-links-list": ["lien-securise"], "dashboard-link-identification": ["lien-securise"],
  "dashboard-link-status": ["annonce"], "dashboard-link-public-url": ["lien-securise"], "dashboard-link-matching-status": ["matching-relationnel", "correspondance-potentielle"],
  "dashboard-link-open-matching": ["matching-relationnel"], "dashboard-link-case-count": ["dossier", "candidat"], "dashboard-link-public-view": ["annonce"],
  "dashboard-link-archive": ["archivage"], "dashboard-link-admission": ["admission", "identite-goodissima-verifiee"],
};

export const dashboardSequences: BoussoleSequence[] = [
  { id: "repères", title: "Prendre ses repères", description: "Situer la navigation, la création et la synthèse.", steps: [
    step("dashboard-menu", "Menu Dashboard", "Retrouvez ici l’entrée du Dashboard.", "Le menu Dashboard ramène à la vue d’ensemble de votre activité, sans déclencher d’action métier."),
    step("dashboard-create-actions", "Actions de création", "Créez un lien simple ou préparez une opportunité.", "Ces raccourcis ouvrent un parcours de création. Rien n’est publié ou diffusé automatiquement."),
    step("dashboard-indicators", "Mosaïque de synthèse", "Lisez les indicateurs de votre compte.", "Chaque tuile repose sur les données réelles du compte et ouvre l’objet concerné. Elle ne décide pas de vos priorités."),
  ]},
  { id: "activité", title: "Comprendre l’activité", description: "Lire la chronologie et retrouver un lien.", steps: [
    step("dashboard-recent-activity", "Chronologie", "Consultez les événements récents.", "La chronologie présente uniquement les événements réellement enregistrés et permet d’en ouvrir le contexte."),
    step("dashboard-links-list", "Liste des liens", "Retrouvez les liens sécurisés visibles.", "La liste rassemble les liens de votre compte correspondant au filtre courant."),
    step("dashboard-link-filters", "Recherche et filtres", "Affinez la liste sans modifier les liens.", "La recherche et les filtres changent seulement l’affichage local. Ils ne modifient aucun statut."),
  ]},
  { id: "carte", title: "Lire la carte d’un lien", description: "Comprendre les informations et l’état réel du matching.", steps: [
    step("dashboard-link-identification", "Identification", "Identifiez le lien et son contexte.", "Le titre, la ville éventuelle et le parcours source permettent d’identifier ce lien réel."),
    step("dashboard-link-status", "Statut", "Vérifiez le statut actuel de l’annonce.", "Le badge indique le véritable statut enregistré : actif, brouillon, publié ou archivé selon le lien."),
    step("dashboard-link-public-url", "URL publique", "Repérez l’adresse publique du lien.", "Cette URL ouvre l’annonce publique. La Boussole ne la copie et ne la diffuse jamais."),
    step("dashboard-link-matching-status", "État du matching", "Lisez le véritable état du matching.", "La carte indique si le matching est désactivé, à analyser, à examiner, sans résultat ou en attente d’une décision humaine."),
    step("dashboard-link-open-matching", "Ouverture du matching", "Ouvrez l’examen du matching si cette action existe.", "Ce bouton apparaît uniquement lorsqu’une action humaine de matching est possible. Il ne lance rien depuis la Boussole."),
    step("dashboard-link-case-count", "Nombre de dossiers", "Consultez le nombre réel de dossiers.", "Aucun candidat reçu n’est annoncé lorsqu’aucun dossier candidat n’existe."),
  ]},
  { id: "agir", title: "Agir sur un lien", description: "Repérer les actions disponibles sans les déclencher.", steps: [
    step("dashboard-link-actions", "Groupe d’actions", "Voici les actions disponibles pour ce lien.", "Toutes ces actions exigent votre clic explicite. La Boussole ne les exécute jamais."),
    step("dashboard-link-copy", "Copier", "Copiez l’URL dans votre presse-papiers.", "La copie reste locale à votre navigateur et n’envoie aucun message."),
    step("dashboard-link-share", "Partager", "Utilisez le partage proposé par votre appareil.", "Le partage ne démarre qu’après votre clic et reste sous votre contrôle."),
    step("dashboard-link-public-view", "Voir l’annonce publique", "Prévisualisez ce que verra le public.", "Cette action ouvre l’annonce publique sans créer de dossier."),
    step("dashboard-link-manage", "Gérer", "Ouvrez la gestion du lien.", "La page de gestion permet d’examiner les réglages ; la Boussole ne les modifie pas."),
    step("dashboard-link-archive", "Archiver", "Archivez uniquement après décision explicite.", "L’archivage rend l’annonce inactive et reste toujours une action métier manuelle."),
  ]},
  { id: "accès", title: "Contrôler l’accès et la diffusion", description: "Comprendre l’admission et le QR code.", steps: [
    step("dashboard-link-admission", "Admission", "Choisissez qui peut créer un dossier.", "Le mode ouvert accepte une réponse anonyme ; le mode vérifié exige une identité Goodissima vérifiée. La préférence Boussole ne change jamais ce réglage."),
    step("dashboard-link-qr", "QR code", "Affichez l’accès public sous forme de QR code.", "Le QR code encode uniquement l’URL publique du lien affiché."),
    step("dashboard-link-qr-download", "Téléchargement du QR code", "Téléchargez l’image uniquement si vous le souhaitez.", "Le téléchargement est local et ne diffuse ni ne transmet automatiquement le QR code."),
  ]},
];

export const dashboardSteps = dashboardSequences.flatMap((sequence) => sequence.steps);
