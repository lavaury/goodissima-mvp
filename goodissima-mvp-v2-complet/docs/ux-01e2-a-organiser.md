# UX-01E.2 — À organiser

Baseline : `98cc00396086fad34d6da8a48b772341c09d9684`, branche `hotfix/privacy-noindex-production`, vérifiée identique au distant. Aucun commit/push dans ce lot ; `m1a/` reste non suivi et intact.

## Contrat et périmètre

Mes espaces présente les objets utilisateur actuellement sans Workspace direct. Organisation volontaire, sans alerte ni compteur exhaustif. Les objets restent ouvrables même sans destination disponible. Les trois actions métier existantes sont réutilisées avec `attachmentMode=unassigned` : une écriture conditionnelle refuse un objet déjà rattaché, sans déplacement implicite. Les autres appelants historiques conservent leurs modes.

| Objet | Propriété / qualification | Action | Effet annoncé avant confirmation | Destination propriétaire |
| --- | --- | --- | --- | --- |
| Lien simple | GLink.ownerId de session, workspaceId null, simpleLink:true | attachGLinkToWorkspaceAction | Aucun dossier rattaché, même si une option de cascade est ajoutée à ce mode | /links/[id] |
| Opportunité | Même propriété, creationSource:opportunity | attachGLinkToWorkspaceAction | Même mode conservateur | /links/[id] |
| Parcours gouverné | Preuve initiale ou génération validée, READ DEBT-AUTH-02, sans Workspace | attachGovernedJourneyToWorkspaceAction | Workspace et metadata de version actualisés ; liens/dossiers non déplacés | /gouvernance/parcours/[formTemplateId]/pilotage |
| Dossier | RelationCase.ownerId de session, workspaceId null | attachRelationCaseToWorkspaceAction | Lien parent également rattaché s’il est propriétaire et encore sans Workspace ; autres dossiers inchangés | /cases/[id] |

Les Dossiers sont inclus : propriété directe, projection et destination existantes sûres ; la cascade conditionnelle est expliquée avant le bouton. Les liens historiques non qualifiés restent « Lien ». Aucun support technique de Lien simple sans preuve de parcours utilisateur ne devient un parcours.

## Lecture et sécurité

Chaque collection et les destinations affichent au plus 20 éléments, avec une lecture de 21 pour déterminer « Voir plus », et navigation précédente. Pagination indépendante par type, tri déterministe date/id (nom/id pour les Workspaces), paramètres validés. Aucun comptage exhaustif, N+1 ou lecture de tous les ids de templates préalable.

Les parcours utilisent le prédicat candidat de création extrait du contrat READ existant, appliqué dans Prisma avant la limite. Les preuves fiables, y compris contradictoires, sont sélectionnées en lot puis vérifiées par `resolveTemplateAccess`. La pagination porte sur les candidats : une page entièrement refusée conserve son accès à la suivante. Un seul formulaire déterministe est sélectionné par parcours. Les snapshots de preuve restent nécessaires au contrat READ.

Session, propriété objet, destination propriétaire ACTIVE et garde MUTATE sont revérifiées par les actions serveur. Aucun ownerId client n’autorise une opération. Le mode conservateur ne charge pas les dossiers du lien. La cascade Dossier → lien utilise aussi une écriture conditionnelle ownerId/workspaceId null. Les projections source et destination sont revalidées après succès ; aucun historique métier n’est réécrit hors des metadata organisationnelles historiques du parcours.

## Impact Boussole

Procédure `docs/boussole-maintenance.md` consultée. EMPTY et POPULATED évalués ; FOCUSED inchangé. Tous les identifiants de cibles et d’étapes sont conservés ; les cibles de premier objet désignent des lignes réelles. Aucun objet factice en application. Les états vides décrivent désormais une page, sans affirmer que toute la collection est organisée. `organize-unassigned` passe de 1 à 2 pour ce changement de sens ; explication de cascade précisée. Autres micro-parcours, Accueil « Bien démarrer », fallback et fonction « Montrer la zone » inchangés.

## Validation

- Tests ciblés : 137/137, dont `qa/unassigned-objects.test.ts` 39/39, READ/USE 40/40, MUTATE 43/43, Mes espaces 7/7 et détail Workspace 8/8. Modules réels exécutés avec dépendances session/Prisma isolées ; aucun accès à une base métier.
- Boussole : `npm.cmd run qa:boussole-maintenance`, 55/55.
- Navigateur : `node --experimental-strip-types scripts/qa-unassigned-objects.mjs`, Chrome headless avec composant serveur réel et CSS Tailwind ; 320, 375, 768, 1024, 1440, états peuplé/vide/sans destination, aucun débordement avec titres longs, boutons et sélecteurs ≥44 px, labels, focus clavier, soumission clavier/souris/tactile. Fixtures isolées uniquement, sans opération métier.
- `npm.cmd run typecheck` : zéro diagnostic final. `npm.cmd run build` : succès, 61/61 pages ; avertissements de cache webpack non bloquants. `git diff --check` conforme.

## Réserves pour revue humaine

Pas de recette sur base réelle ni de session Preview A/B. La pagination par offset peut évoluer si la collection change pendant la navigation ; revenir à la page précédente permet de retrouver les éléments. Les provenances contradictoires peuvent produire une page vide avec « Voir plus ».

Le contrôle historique supplémentaire de rattachement des parcours reste applicable : certains parcours issus d’une génération validée lisibles mais dépourvus de metadata compatibles peuvent encore être refusés à la mutation. Aucune garde n’est assouplie. Les templates historiques sans provenance restent exclus et les liens non qualifiés restent « Lien ».

Les dettes D-002/D-004/D-015/D-019/D-020 sont inchangées. Aucun modèle Prisma, migration, Favoris, Recherche, Alertes, menu généralisé, clic droit ou UX complète de déplacement. Revue humaine requise avant tout commit.
