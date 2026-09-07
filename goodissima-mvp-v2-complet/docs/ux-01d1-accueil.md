# UX-01D.1 — Accueil : orientation et activité récente

## A–C. Structure et portes

`/dashboard` présente le titre Accueil et trois liens compacts accompagnés de leur intention : Boussole (`/boussole/decouverte`), Annuaire (`/annuaire`), Mes espaces (`/gouvernance`). L’email quitte le contenu principal ; le menu Utilisateur conserve les accès personnels.

## D–G. Retraits limités à cette surface

Les créations globales, la vue exécutive/IA, les 17 KPI, la campagne Champagne, la recherche, les filtres et les cartes de liens ne sont plus montés sur Accueil. Aucun nouveau menu global ni agrégateur n’est introduit.

Accès vérifiés avant retrait : Lien simple dans les autres accès du menu Utilisateur et Boussole ; création d’opportunité dans `/opportunities` et Boussole ; créations contextualisées dans les espaces ; gestion, matching, dossiers, admission, partage et archivage des liens dans les cartes de `/opportunities` et les fiches `/links/[linkId]`. La campagne reste dans `/administration#tests-champagne`. Les routes et capabilities ne changent pas. `LinkCard`, `DashboardLinkFilters`, les helpers de compteurs et le composant Champagne sont conservés. La recherche locale propre à l’ancien dashboard n’est pas réécrite ailleurs dans ce lot.

## H–J. Activité, repository et états

`getDashboardActivity(ownerId)` effectue trois lectures parallèles : GLink, RelationCase, Document. Chaque lecture trie par createdAt puis id décroissants et limite à cinq lignes. Les projections ne chargent que identifiant, date, titre de contexte et identifiant de destination. La fusion locale limite le résultat final à cinq événements, avec départage déterministe des dates égales.

Les liens et dossiers filtrent directement ownerId ; les documents filtrent relationCase.ownerId. L’accès est authentifié avant lecture. Les destinations internes `/links/[id]` et `/cases/[id]` contrôlent leur propriétaire côté serveur. Aucune URL candidate, identité candidate, contenu documentaire, token ou email n’est sélectionné.

Libellés : « Lien créé », « Dossier ouvert », « Document déposé ». Dates absolues avec élément time, date ISO et affichage explicite dans le fuseau Paris. Pas de publication déduite de createdAt, pas de temps réel, pas de promesse d’activité exhaustive ou de mémoire gouvernée. Les créations anciennes d’objets désormais archivés peuvent être présentes : leur libellé reste une création, pas leur statut courant.

EMPTY signifie absence d’événements présentés, sans affirmer l’absence de Portfolios/Workspaces. POPULATED utilise la même structure et ajoute la section conditionnelle. Aucun FOCUSED ni historique de consultation n’est inventé.

## K. Boussole

Maintenance consultée avant modification. Les micro-parcours `repères` et `activité` passent chacun en version 2 : nouvelles étapes d’orientation pour le premier, suppression des étapes de liste/filtres et restriction POPULATED pour le second. Les guides `carte`, `agir`, `accès` quittent le dashboard ; les guides Opportunités existants ne sont pas dupliqués ni modifiés.

Cibles conservées selon leur sens : dashboard-menu, open-boussole-from-dashboard, dashboard-recent-activity et timeline-created-link pour une création de lien. Nouvelles cibles : dashboard-open-directory, dashboard-open-spaces. Les références de glossaire aux anciennes cartes/créations du dashboard sont retirées ; leurs destinations métier existantes subsistent. dashboard-indicators n’est pas réaffecté.

Le dashboard est inscrit au registre avec EMPTY/POPULATED uniquement. L’état provient de la présence réelle de dashboard-recent-activity ; le contexte transmis à Boussole ne contient ni id métier ni contenu d’événement. Montrer une zone reste sans navigation, mutation ou appel IA automatique.

## L–M. Navigation et accessibilité

Shell, breadcrumb Accueil, remontée racine et historique natif restent inchangés. Liens natifs, focus visible, titres et listes sémantiques, dates lisibles. Une seule colonne centrée, sans défilement interne, sans placeholder ou filtre aria-pressed. Les contextes longs utilisent un retour à la ligne y compris sans espaces.

## N. Performance

Avant : environ 16 à 17 opérations ORM métier hors auth/shell, avec collections complètes de liens/dossiers/actions et lectures de matching, archives et IA.

Après : trois opérations ORM métier bornées, au plus quinze lignes principales avant fusion et cinq événements affichés. Les titres liés utilisent des projections imbriquées ; ce nombre ORM n’est pas une mesure du nombre SQL généré par Prisma. Aucun N+1 explicite, cache, table, index, modèle Prisma ou moteur IA ajouté. L’authentification existante demeure inchangée.

## O–Q. Validation et diff

Tests ciblés : structure EMPTY/POPULATED, suppression des blocs, rendu échappé et dates, authentification avant lecture, filtrage propriétaire A/B, trois sources, ordre, limite, destinations, absence de chargements historiques, cibles réelles et versions Boussole. Les anciens tests dashboard ont été adaptés à son changement de rôle en conservant les contrôles de cartes dans leur surface métier.

Le banc Chrome existant utilise les véritables composants React et le CSS Tailwind, avec routeur/auth et données de test locaux ; il ne constitue pas une recette de la base réelle ou du déploiement Preview. Il couvre les états de l’Accueil aux cinq largeurs et conserve les contrôles de navigation/Workspace/Portfolio existants. Captures et logs restent dans TEMP.

Résultats : 19 tests ciblés dashboard/intégration, 89 tests navigation/shell et guides métier associés, 55 tests de maintenance Boussole réussis. Chrome valide EMPTY/POPULATED à 320, 390, 768, 1024 et 1440 px : aucun overflow horizontal ni scroll interne, focus clavier visible et liens canoniques. Les contrôles préexistants Workspace/Portfolio, historique, shell et exclusions passent également. Captures mobile et desktop relues. Le premier lancement Chrome dans la sandbox est resté bloqué ; le contrôle a réussi hors sandbox.

Build exécuté une fois : compilation applicative réussie, puis échec connu `app/api/documents/upload/route.ts:128`, `FormData.get`. Avertissements de cache webpack non bloquants. `tsconfig.tsbuildinfo` restauré à son état initial.

Contrôle TypeScript complémentaire sans émission, hors `m1a/` et sans modifier tsconfig : aucun diagnostic dans le lot ; seuls les diagnostics QA préexistants TS2352 (`qa/candidate-form-safety.test.ts:28`) et TS7023 (`qa/matching-lifecycle.test.ts:27`) restent présents. L’exécution brute de tsc inclut aussi le dépôt local `m1a/` et ses diagnostics hors périmètre.

UTF-8 strict vérifié et `git diff --check` conforme. Aucun commit ni push. `m1a/` reste hors périmètre.

## R. Registre complet des dettes connues

| Dette | Origine | Risque | Chantier recommandé | Statut |
|---|---|---|---|---|
| FormData.get dans upload documentaire | Build antérieur, route.ts:128 | Build complet bloqué | Typage/upload dédié | Reportée |
| AI-WORKSPACE-SCOPE | Contexte IA Gouvernance historique | Contexte plus large que le Workspace | Bornage IA dédié | Ouverte |
| Autorisation propriétaire archive RelationTemplate | Route historique | Autorisation indue | Sécurité serveur | Ouverte |
| Création/réactivation Workspace par nom | Upsert historique de création de parcours | Réactivation involontaire | Cycle de vie Workspace | Reportée |
| Slug dans Informations Portfolio | Champ technique conservé UX-01C | Jargon sans utilité démontrée | Finition Portfolio | Reportée |
| Workspace produit V1 | Formulaire existant | Texte interne | Finition éditoriale | Reportée |
| Bandeau V1 | Formulaire existant | Charge et promesses futures | Finition éditoriale | Reportée |
| Rubrique produit | Taxonomie de création | Compréhension incertaine | Clarification catégories | Reportée |
| Type d’usage Gouvernance | Taxonomie existante | Faible discrimination | Clarification formulaire | Reportée |
| Autre · Gouvernance | Affichage Workspace | Faible valeur informative | Finition Workspace | Reportée |
| Textes Mes espaces | Pédagogie conservée UX-01C | Densité | Allègement éditorial | Reportée |
| Densité verticale des listes | Présentation UX-01C | Lecture longue | Finition responsive | Reportée |
| Agrégats templates/optimisations insuffisamment bornés | Ancien dashboard et destinations métier | Volumes transversaux | Revue dédiée des agrégats | Ouverte ailleurs ; chargements retirés d’Accueil |
| Dossiers actifs, attente de contact, doublons, archives hétérogènes | Définitions historiques | Nombres trompeurs | Clarification métier | Reportée ; non repris sur Accueil |
| Boussole dashboard toujours EMPTY/non déclaratif | Intégration historique | Guidage incohérent | UX-01D.1 | Traitée pour Accueil |
| Live et Publié injustifiés | Ancienne chronologie | Fraîcheur/statut trompeurs | UX-01D.1 | Traitée pour Accueil |
| Confusion Admin/capabilities | Présentation des accès existants | Confusion des droits | Revue distincte Administration | Ouverte |

## S. Réserves

Recette humaine avec sessions et données réelles nécessaire. Les tests de repository contrôlent les requêtes émises avec doubles Prisma ; ils ne simulent pas une preuve d’isolation en base de production. Les dettes ci-dessus ne sont pas remboursées par ce lot. L’activité est une sélection de créations/dépôts, pas une mémoire gouvernée ni une mesure du dernier usage des espaces.
