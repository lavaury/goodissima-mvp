# UX-01C.2A — Portfolio dans Explorer

## A–C. Présentation et réemploi

La route `/gouvernance/portfolios/[id]` conserve son identité et son authentification. Elle présente le nom, le statut réel, la description éventuelle et les Workspaces comme niveau enfant de Mes espaces. Piloter reste visible. Les anciens retours, le vocabulaire produit/V1 et les grandes cartes de compteurs ne sont plus dans le contenu principal.

`WorkspaceRow` est extrait de `SpacesTreeView` et partagé avec `PortfolioExplorerView`. Son JSX est conservé, avec paramétrage de la cible du premier Workspace réel selon la page. Nom, statut, trois compteurs directs et destination canonique sont identiques. Aucun tableau, ARIA tree, sélection ou double-clic.

## D. Lecture ciblée

`getPortfolioExplorer` lit le Portfolio par `id + ownerId`. Ses Workspaces sont également filtrés par `portfolioId + ownerId`, triés par nom puis ID, avec statut et `_count` seulement. Les filtres des compteurs parcours/liens/dossiers sont comparés à ceux de Mes espaces dans les tests. Les communications sont comptées avec le propriétaire pour Informations.

Un appel ORM principal, puis une lecture des Workspaces disponibles uniquement pour un Portfolio actif. Aucun chargement de toute l'arborescence, aucun chargement des objets enfants et aucune requête par Workspace. Le nombre SQL interne à Prisma n'a pas été mesuré. Les listes restent proportionnelles au nombre de Workspaces, sans pagination nouvelle.

## E–F. Panneaux secondaires

Organiser utilise `details/summary`, fermé par défaut. Il contient les formulaires de rattachement/détachement existants et l'explication de leurs effets. Un Portfolio archivé conserve le détachement, mais ne présente pas de formulaire de rattachement.

Les actions serveur ne sont pas modifiées. Le rattachement vérifie le propriétaire des deux objets et le statut actif du Portfolio cible ; il ne vérifie pas l'absence de Portfolio ni le statut du Workspace. Le détachement vérifie le propriétaire du Workspace et efface son rattachement actuel. Ces différences avec les filtres de la liste disponible restent inchangées, et sont couvertes par les tests de contrat.

Informations, fermé par défaut, conserve type, slug, date, totaux directs et communications, ainsi que l'accès à la collection historique des Portfolios. Les données ne deviennent pas des commandes de navigation principales.

## G–I. Piloter, Boussole, navigation

Le lien Piloter ouvre le pilotage Portfolio existant. Son moteur et son assistant ne changent pas. Le breadcrumb devient `Accueil > Mes espaces > Portfolio > Piloter`. La page Portfolio remonte à Mes espaces ; le pilotage remonte au Portfolio. Les Workspaces conservent leur destination `/gouvernance/workspaces/[id]`.

La procédure `docs/boussole-maintenance.md` a été consultée. La collection, le détail et le pilotage ont des contextes distincts. La création Portfolio ne reçoit plus le guide de collection. Les trois sources Portfolio sont enregistrées dans le registre central.

- Collection : EMPTY sans première carte réelle, POPULATED avec cette carte.
- Détail/pilotage : FOCUSED uniquement si la cible du Portfolio autorisé est effectivement rendue ; la route seule ne suffit pas.
- Un Portfolio vide reste un objet FOCUSED, avec un état enfant honnêtement vide.
- Les cibles Workspace sont optionnelles et issues des enfants réels.
- Organiser est guidé par sa commande visible : la Boussole met en évidence le summary. L'utilisateur développe le panneau ; aucune soumission ni navigation automatique.
- `portfolio-counters` passe en version 2, car son explication du pilotage change de sens. Les autres anciens parcours restent en version 1. Les deux nouveaux parcours commencent en version 1.
- Le discours obsolète est corrigé dans le guide et dans le texte de la collection. L'assistant du pilotage conserve sa possibilité existante de sélectionner le périmètre global ; le nouveau guide le précise.

## J–K. Validation

- 207 tests concernés réussis, dont 9 nouveaux tests Portfolio Explorer/actions et la non-régression UX-01C.1.
- Maintenance Boussole complète : 55 tests réussis.
- Chrome : 320, 390, 768, 1024, 1440 px, liste Portfolio, noms longs, statut archivé, panneaux fermés/ouverts, activation clavier, focus, absence de soumission à l'ouverture, destinations Workspace/Piloter et historique. Aucun overflow horizontal. Contrôles Mes espaces/Workspace/shell existants conservés.
- Captures mobile et desktop inspectées. Les artefacts Chrome sont dans le dossier temporaire système, hors du lot.
- Le harnais rend les composants réels avec transport Next et dépendances simulés. Les tests serveur exécutent les fonctions avec un Prisma en mémoire ; aucune validation sur base ou session de Preview réelle n'est revendiquée.
- TypeScript sans émission : uniquement les diagnostics QA connus TS2352 (`candidate-form-safety:28`) et TS7023 (`matching-lifecycle:27`).
- UTF-8 et marqueurs de conflits vérifiés ; `git diff --check` réussi.

## L. Build

Build exécuté une fois : compilation applicative réussie, puis échec connu sur `app/api/documents/upload/route.ts:128`, `Property 'get' does not exist on type 'FormData'`. Des avertissements de cache webpack sont également présents. `tsconfig.tsbuildinfo` est restauré après le contrôle.

## M–N. Périmètre et réserves

Créés : trois composants (WorkspaceRow, PortfolioExplorerView, PortfolioOrganize), repository Portfolio Explorer, guide détail/pilotage, helper de contexte Portfolio, suite QA et ce rapport.

Adaptés : page détail Portfolio, marqueur réel du pilotage, texte de collection, partage de la ligne dans Mes espaces, contexte/runtime/registre Boussole, guide Portfolio, breadcrumb, tests existants et harnais Chrome.

Prisma, actions serveur, moteur Piloter, création Workspace, dettes techniques et fonctionnalités hors lot restent inchangés. `m1a/` reste exclu. Aucun commit ni push. UX-01C.2B n'est pas commencé.

Réserves : recette humaine Preview requise ; build bloqué par la dette connue ; listes chargées entièrement ; sémantique historique des actions et du pilotage conservée.

UX-01C.2A :
- [ ] prêt
- [x] prêt avec réserves
- [ ] bloqué
