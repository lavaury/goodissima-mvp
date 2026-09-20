# UX-01C.1 — Mes espaces : arborescence Portfolio → Workspace

## A–C. Surface et hiérarchie

La route /gouvernance reste la porte Mes espaces. Son titre et son introduction sont remplacés par Mes espaces et une description courte. Les Portfolios contiennent directement leurs Workspaces dans des listes imbriquées. Seuls les Workspaces avec portfolioId strictement null apparaissent dans Workspaces sans Portfolio.

getSpacesTree effectue deux lectures Prisma principales, toutes deux filtrées par ownerId : Portfolios et Workspaces avec compteurs directs. Une Map construit la hiérarchie depuis portfolioId en temps linéaire. Un parent absent de la liste autorisée n'entraîne jamais un reclassement à la racine ; un message indique le nombre de Workspaces non affichables sans exposer leur parent. Aucun modèle, relation ou donnée artificielle n'est créé.

## D–F. Divulgation et création

Chaque Portfolio a un bouton natif développer/réduire avec aria-expanded et aria-controls, distinct du lien Ouvrir. Jusqu'à cinq Portfolios, tous commencent développés ; au-delà, seul le premier, dans l'ordre déterministe nom puis ID, commence développé. Aucun état n'est persisté. L'état local peut être réinitialisé lors du remontage de la page.

La section Workspaces sans Portfolio conserve ce libellé explicite et ne s'appelle pas Non classés. Le menu racine + Nouveau propose uniquement Workspace et Portfolio, vers leurs formulaires existants. Escape rend le focus à sa commande ; le clic extérieur ferme le menu.

## G–H. Anciennes cartes et destinations

Les grandes cartes Salle de pilotage, création de parcours et Annuaire sont retirées. Les fonctions restent accessibles via la navigation existante : Annuaire global ; Nouveau parcours, Lien simple et Salle de pilotage dans Autres accès ; créations contextualisées dans chaque Workspace.

Les Workspace ouvrent /gouvernance/workspaces/[id] et les Portfolio /gouvernance/portfolios/[id]. Aucun retour au premier parcours. Les formulaires de création existants et leurs redirections ne changent pas.

Les formulaires historiques de rattachement parcours/dossiers/liens sont extraits dans SpacesExistingAttachments et conservés sous l'arborescence, séparés visuellement. C'est une préservation de fonctionnalités déjà présentes, pas l'implémentation de UX-01C.2 : aucune nouvelle vue Non classés, aucun compteur unifié et aucune nouvelle action. Leur code métier et leurs confirmations sont conservés ; seuls les minimums de largeur des sélecteurs sont assouplis pour mobile.

## I. Boussole

Procédure docs/boussole-maintenance.md consultée. Le contexte conserve son ID governance et devient Comprendre Mes espaces. Les cibles réutilisées gardent leur identifiant et correspondent toujours à des objets/commandes réels. Le guide de la page passe de sept micro-parcours/42 étapes à quatre/27 étapes :

- understand-governance, governance-summary, understand-workspaces : version 2, car étapes, sens ou conditions évoluent avec la hiérarchie ;
- organize-unassigned : version 1, séquence historique et cibles préservées ;
- create-governed, read-governed-journey et governance-pilotage ne sont plus proposés comme guides de cette page. Les créations et cockpits gardent leurs propres guides existants. Les anciennes progressions ne sont ni réécrites ni purgées.

Le glossaire réutilise les cibles réelles de navigation et de Workspace. La maintenance complète passe. EMPTY/POPULATED restent fondés sur les cibles réelles ; un Workspace FOCUSED conserve son exclusion du guide de collection. Aucun objet n'est créé pour satisfaire une cible.

Un helper limité aux conteneurs explicitement marqués reconnaît une cible dans le contenu replié d'un Portfolio. Révéler émet un événement local sur ce conteneur ; le composant développe sa liste synchroniquement avant la mesure Boussole. Aucun clic, navigation ou appel serveur. Les autres éléments cachés restent exclus. Le mécanisme existant de divulgation du menu global reste inchangé.

## J–L. Navigation, responsive et accessibilité

Le ConnectedShell, la navigation globale, les helpers de breadcrumb, le middleware et les surfaces B/C ne changent pas. Accueil > Mes espaces, puis Portfolio et/ou Workspace utilisent les relations autorisées existantes. Retour/Suivant/Remonter sont conservés.

Listes ul/li imbriquées, boutons natifs, focus visible, noms métier multilignes et libellés Portfolio/Workspace complètent les pictogrammes distincts. La compréhension ne dépend pas de la couleur. Mobile : indentation réduite, compteurs sous le nom et commandes de 44 px minimum. Aucun ARIA tree, sélection, double-clic ou drag & drop.

## M. Performance et limites

L'arborescence ne charge ni objets enfants, snapshots, identités candidates ni signaux de pilotage. Les compteurs des liens/dossiers filtrent également le propriétaire ; les parcours sont rattachés directement au Workspace propriétaire. Le regroupement est O(P + W), sans requête par Portfolio ou Workspace.

- 10 Workspaces : faible volume de données et de DOM attendu ;
- 100 : mêmes deux appels ORM, payload et DOM proportionnels ;
- 1000 : contrat de deux lectures testé en mémoire, mais liste complète toujours chargée. Aucun benchmark de base réelle ni garantie de latence ; pagination à examiner selon volumes réels, sans virtualisation introduite prématurément.

La page garde quatre lectures historiques supplémentaires pour les formulaires de rattachement. Leurs listes et options ne sont pas paginées ; leur poids reste proportionnel aux objets non assignés et aux Workspaces actifs. Cette réserve est conservée pour ne pas transformer les fonctions hors lot. Les appels ORM ne représentent pas un nombre SQL mesuré : Prisma peut effectuer des lectures relationnelles supplémentaires. L'authentification existante reste inchangée.

## N–O. Vérifications

- 197 tests ciblés réussis : Mes espaces, Workspace, créations, Portfolio, navigation spatiale, ConnectedShell, UX-01A hardening, Gouvernance, intégration UX et Boussole concernée.
- Maintenance Boussole complète : 54 tests réussis.
- Chrome aux largeurs 320, 390, 768, 1024 et 1440 : hiérarchie, développer/réduire au clavier, aria-expanded, focus, ouverture canonique, menu de création, révélation Boussole sans navigation, historique et absence d'overflow ; vérification complémentaire avec noms métier longs.
- Les tests utilisent les vrais composants et fonctions avec dépendances en mémoire ; le harnais Chrome simule le transport Next et les données, sans base réelle.
- TypeScript hors .next et m1a : uniquement les diagnostics QA connus TS2352 (candidate-form-safety:28) et TS7023 (matching-lifecycle:27), aucun nouveau diagnostic.
- git diff --check : réussi.
- Build : compilation applicative réussie, puis échec sur la dette connue app/api/documents/upload/route.ts:128 (FormData.get). tsconfig.tsbuildinfo restauré après exécution.

## P. Réserves

Recette humaine avec le routeur Next, sessions et données réelles requise. Les limites du chargement historique des rattachements sont conservées. Aucune nouvelle règle d'archivage ou capability : les espaces archivés sont consultables et leurs destinations conservent leurs contrôles existants. FormData.get, AI-WORKSPACE-SCOPE, archivage template et réactivation historique par nom restent hors périmètre.

## Q. Diff

Créés : components/SpacesTreeView.tsx, SpacesCreateActions.tsx, SpacesExistingAttachments.tsx ; lib/spaces-repository.ts ; lib/boussole/portfolio-disclosure.ts ; qa/spaces.test.ts ; ce rapport.

Adaptés : page /gouvernance ; ContextualBoussole ; contexte, séquences, registre et glossaire Boussole ; quatre suites QA dépendant de l'ancienne page ; harnais Chrome ; commande qa:spaces.

Aucun commit ni push. UX-01C.2 non commencé.

UX-01C.1 :

- [ ] prêt
- [x] prêt avec réserves
- [ ] bloqué
