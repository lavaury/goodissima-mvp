export type CompassEntry = {
  title: string;
  href?: string;
  purpose: string;
  users: string;
  canDo: string;
  doesNot: string;
};

export const compassEntries: CompassEntry[] = [
  { title: "Dashboard", href: "/dashboard", purpose: "Donner une vue d’ensemble de l’activité et des éléments qui demandent votre attention.", users: "Les utilisateurs connectés qui souhaitent reprendre leur activité.", canDo: "Consulter des indicateurs et ouvrir les objets concernés.", doesNot: "Goodissima ne décide pas des priorités et ne traite aucune action à votre place." },
  { title: "Opportunités / annonces", href: "/opportunities", purpose: "Préparer, consulter, publier ou archiver une annonce liée à un besoin.", users: "Les personnes autorisées à porter et publier une opportunité.", canDo: "Structurer un besoin et préparer un brouillon, avec une assistance si elle est disponible.", doesNot: "Aucune annonce n’est publiée et aucune mise en relation n’est lancée automatiquement." },
  { title: "Dossiers", href: "/cases", purpose: "Suivre les dossiers relationnels ouverts à partir d’une annonce ou d’un parcours.", users: "Les responsables et participants disposant d’un accès au dossier.", canDo: "Consulter le contexte, les pièces et les actions visibles du dossier.", doesNot: "Goodissima ne valide pas une personne, un document ou une décision sans intervention humaine." },
  { title: "Workspaces", href: "/gouvernance", purpose: "Organiser des parcours, liens, dossiers et communications dans un périmètre de travail nommé.", users: "Les responsables de gouvernance et les membres explicitement autorisés.", canDo: "Créer un cadre d’organisation et y rattacher explicitement des objets.", doesNot: "Créer ou rattacher un Workspace n’accorde aucun accès et ne lance aucun workflow." },
  { title: "Portfolios", href: "/gouvernance/portfolios", purpose: "Regrouper plusieurs Workspaces pour disposer d’une lecture consolidée.", users: "Les responsables qui pilotent plusieurs espaces ou initiatives.", canDo: "Consulter les regroupements et les signaux issus des données disponibles.", doesNot: "Un Portfolio ne crée ni dossier, ni réunion, ni notification, ni action automatique." },
  { title: "Parcours gouvernés", href: "/gouvernance", purpose: "Définir et suivre un cadre de travail avec ses étapes, participants et règles de validation.", users: "Les responsables du parcours et les participants invités selon leur rôle.", canDo: "Préparer un parcours et rendre ses validations humaines visibles.", doesNot: "L’IA peut proposer, mais elle ne publie, n’invite et ne valide jamais seule." },
  { title: "Pilotage", href: "/gouvernance/pilotage", purpose: "Repérer les situations qui nécessitent une lecture ou une intervention humaine.", users: "Les responsables de gouvernance habilités à examiner les signaux.", canDo: "Examiner des signaux calculés à partir des données disponibles et ouvrir leur contexte.", doesNot: "La salle de pilotage n’envoie rien, n’ouvre aucun accès et n’exécute aucun workflow." },
  { title: "Invitations gouvernées", purpose: "Associer une personne à un parcours avec un rôle et un accès explicitement définis.", users: "Les responsables habilités à inviter et les destinataires de l’invitation.", canDo: "Préparer et suivre une invitation depuis le parcours concerné.", doesNot: "Aucune invitation n’est créée, envoyée, acceptée ou transformée en accès automatiquement." },
  { title: "Communications sécurisées", purpose: "Échanger dans le contexte d’un dossier ou d’un parcours avec des canaux autorisés.", users: "Les participants dont l’accès au canal a été explicitement autorisé.", canDo: "Utiliser les canaux visibles dans le contexte auquel vous avez accès.", doesNot: "Goodissima ne contacte personne, ne démarre aucune visio et n’enregistre rien automatiquement." },
  { title: "Revues de gouvernance", purpose: "Relire les faits, propositions et décisions d’un parcours avant de poursuivre.", users: "Les responsables et participants autorisés à contribuer à la revue concernée.", canDo: "Examiner les éléments disponibles et préparer une décision traçable.", doesNot: "Goodissima ne convoque pas de réunion, ne produit pas de décision et ne l’approuve pas seule." },
  { title: "Annuaire", href: "/annuaire", purpose: "Retrouver des identités et préparer une relation dans un cadre de confiance.", users: "Les utilisateurs connectés autorisés à consulter l’annuaire.", canDo: "Consulter les informations prévues par le produit et les accès de confiance associés.", doesNot: "L’annuaire n’expose pas de coordonnées sensibles et ne crée aucune relation automatiquement." },
  { title: "Archives", href: "/opportunities?view=archived", purpose: "Retrouver les annonces archivées sans les confondre avec l’activité en cours.", users: "Les propriétaires et responsables autorisés à consulter ces annonces.", canDo: "Consulter séparément les annonces archivées.", doesNot: "Archiver ne supprime pas silencieusement les données et ne relance aucune publication." },
  { title: "Paramètres / IA", href: "/settings", purpose: "Consulter les réglages applicables et comprendre les fonctions d’assistance IA disponibles.", users: "Chaque utilisateur pour ses réglages, et les rôles habilités pour les contrôles élargis.", canDo: "Modifier les réglages proposés et utiliser les aides disponibles dans leur contexte.", doesNot: "L’IA ne remplace pas la validation humaine et ne déclenche ni message, ni publication, ni décision." },
];

export const compassIntroduction = "Cette Boussole explique les principales zones privées de Goodissima. Elle est uniquement informative : elle ne crée rien, n’envoie rien et ne déclenche aucune action. Toute proposition reste soumise à une validation humaine explicite.";

export function compassSpeechSections() {
  return [
    `Boussole Goodissima. ${compassIntroduction}`,
    ...compassEntries.map((entry) => `${entry.title}. À quoi sert cette zone ? ${entry.purpose} Qui l’utilise ? ${entry.users} Ce que vous pouvez faire. ${entry.canDo} Ce que Goodissima ne fait pas automatiquement. ${entry.doesNot}`),
    "Principe V1. Toute publication, invitation, autorisation, communication, réunion ou décision reste une action humaine explicite.",
  ];
}

export function compassAIContext() {
  return compassEntries.map(({ title, href, purpose, users, canDo, doesNot }) => ({ title, href: href ?? null, purpose, users, canDo, doesNot }));
}
