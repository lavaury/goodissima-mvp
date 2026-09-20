# UX-01B.2 — Pilotage Workspace V1

## Résultat

Piloter remplace la vue d’attente dans la page Workspace existante.
Sections : volumes directs, À examiner, Réunions à venir, Communications récentes.
Explorer, son repository, le shell, le middleware, le breadcrumb et les surfaces B/C
gardent leurs contrats. UX-01B.3 n’est pas commencé.

## Contrat par requête

| Lecture | Catégorie | Règle |
| --- | --- | --- |
| Page et compteurs | DIRECT | Workspace par id + propriétaire ; longueurs des trois collections directes d’Explorer |
| Parcours du moteur existant | PARCOURS | RelationTemplate.workspaceId = Workspace demandé, lui-même du propriétaire |
| Invitations du parcours | DIRECT + contexte PARCOURS | ownerId et workspaceId doivent aussi correspondre ; sans Workspace ou avec un historique différent : exclues |
| Réunions produisant des signaux d’attention | DIRECT + contexte PARCOURS | Même propriétaire et workspaceId, sans dossier, non terminées/annulées/expirées |
| Matching historique des dossiers | DIRECT + contexte PARCOURS | Dossier du propriétaire directement rattaché et parcours dans ce Workspace |
| Matching des liens | DIRECT | Lien actif du propriétaire, workspaceId direct et Workspace propriétaire ; aucune appartenance déduite du template |
| Réunions à venir | DIRECT | CommunicationSession.ownerId et workspaceId ; Workspace propriétaire ; date future, non terminée/annulée/expirée ; 10 premières par date |
| Communications récentes | DIRECT | Même rattachement direct ; updatedAt dans les 14 derniers jours, sans date future ; 10 dernières par date |
| Résumé de matching | Dépendance du lien DIRECT | Repository existant appelé seulement avec les IDs des liens sélectionnés et le propriétaire |
| Destination de communication | Contexte uniquement | Dossier propriétaire, sinon formulaire d’un parcours dont le Workspace est au propriétaire ; aucun effet sur l’appartenance |

ASSOCIATION INDIRECTE : toujours exclue. Aucun GLINK_FALLBACK, aucun héritage pour un
workspaceId absent. Déplacer un parcours ne réattribue pas ses anciennes sessions :
elles restent affichées dans le Workspace enregistré, même si leur lien ouvre le
parcours désormais situé ailleurs. Le libellé précise le rattachement enregistré.

Le signal « participant sans accès actif » calculé par comparaison de noms est exclu
de cette vue : une invitation valide conservant un ancien workspaceId pourrait être
absente de la sélection. Cela ne prouve pas une absence d’accès. Le signal existant
« réunion sans invités autorisés », fondé sur les meetingParticipants, reste disponible.

Les invitations ou dossiers dont le parcours a déménagé ne sont pas réattribués via
ce parcours. Leurs anciens signaux dépendant de ce contexte ne sont pas présentés
dans cette V1 ; réunions et communications directes restent consultables.

## Réemploi et comportement

`getGovernancePilotage` reçoit un périmètre Workspace optionnel, appliqué dans Prisma.
Les appels sans ce périmètre conservent les agrégations globale et Portfolio.
Les règles de matching et d’invitation restent celles du moteur existant.
`filterSignalsByWorkspaceId`, `isInterventionSignalKind` et
`summarizeGovernanceAttention` sont réutilisés ; déduplication par identifiant de signal.
Les compteurs agrégés du pilotage global ne sont pas utilisés.
Workspace.updatedAt n’est pas utilisé comme activité.

Chaque signal présente un contexte Parcours ou Lien. Les sessions présentent leur
contexte Dossier/Parcours accessible, ou un libellé neutre. Aucun token ni lien invité
n’est transmis à la vue. Aucune page autonome de réunion n’est inventée.
Une session sans destination propriétaire démontrable reste visible sans lien.
Les heures sont affichées dans le fuseau Europe/Paris.

## Exclusions et dettes

- **AI-WORKSPACE-SCOPE** : l’assistant accepte un scope Workspace sans périmètre
  réellement borné. Il reste exclu et son système n’est pas modifié.
- La dette d’autorisation de `/api/templates/[templateId]/archive` reste hors lot :
  aucune mutation de cette route n’est proposée.
- Aucune notification, création, mutation, prochaine action universelle ou refonte.
- Les listes de sessions sont limitées à 10 ; l’attention réutilise les lectures
  existantes, sans nouvelle pagination. Les très gros Workspaces restent à mesurer.

## Boussole et recette

Procédure `docs/boussole-maintenance.md` consultée. Aucun changement de cible, étape,
ordre ou signification dans les guides existants : journeyVersion inchangé.
Le Workspace FOCUSED conserve le contexte sans guide de collection décidé en B.1 ;
les états vides et peuplés sont réels, sans cible ni donnée fictive dans le produit.
Maintenance complète exécutée. Validation humaine avec données réelles encore requise.
Aucun commit ni push automatique.

## Vérifications

- Nouvelles suites Piloter et Workspace : réussies, avec exécution du moteur réel et
  un adaptateur Prisma en mémoire appliquant les prédicats imbriqués.
- Isolation propriétaire/Workspace, homonymes, rattachements directs, historique après
  déplacement, limites temporelles, absence de doublons et états vides couverts.
- Navigation, ConnectedShell, hardening UX-01A, Gouvernance, Portfolio et maintenance
  Boussole : réussis.
- Chrome avec React/Tailwind réels et transport local simulé : cinq largeurs,
  focus visible, absence d’overflow, Piloter/Explorer et Retour/Suivant vérifiés.
- Aucune session réelle ni base de production utilisée par les tests.
- Build : dette connue FormData.get à l’upload documentaire ; ne pas corriger dans ce lot.
- TypeScript hors `.next` et `m1a` : les deux diagnostics QA préexistants uniquement.

## Diff fonctionnel

- `lib/governance-pilotage-repository.ts` : périmètre optionnel et filtres directs.
- `lib/workspace-pilotage-repository.ts` : composition ciblée, sessions et résumé.
- `components/WorkspacePilotageView.tsx` : présentation de Piloter.
- Page Workspace et `WorkspaceDetailView` : composition serveur, chargement Piloter
  uniquement sur sa vue ; branche Explorer conservée.
- Tests Workspace/Piloter, script Chrome, commande QA et ce compte rendu.
