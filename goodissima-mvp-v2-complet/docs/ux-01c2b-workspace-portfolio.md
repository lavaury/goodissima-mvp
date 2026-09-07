# UX-01C.2B — Création Workspace dans le Portfolio courant

## A. Flux inspecté

Le formulaire `/gouvernance/workspaces/nouveau` utilisait `createWorkspaceAction` avec nom, description, catégorie et type d'usage. Le serveur exige un utilisateur courant, valide un nom d'au moins deux caractères, applique les catégories/types admis (sinon OTHER/GOVERNANCE), génère un slug unique puis crée un Workspace actif. La redirection globale est `/gouvernance`.

Cette action ne réactive pas un Workspace par nom. La dette historique existe dans `createGovernedJourneyAction`, qui utilise un upsert sur ownerId/slug avec update du statut ACTIVE. Ce fichier reste inchangé.

## B–C. Menu et formulaire

Le menu `SpacesCreateActions` accepte désormais un contexte Portfolio optionnel. Depuis un Portfolio actif, il propose uniquement Workspace vers le formulaire existant avec `?portfolioId=...`. Depuis Mes espaces, ses deux destinations Workspace/Portfolio restent identiques.

Le formulaire est extrait dans `WorkspaceCreationForm` pour partager son rendu entre les contrôles et la page serveur. Les champs, valeurs par défaut et limites existants sont conservés. En contexte Portfolio, son nom réel autorisé apparaît dans une section dédiée, sans sélecteur supplémentaire. Un champ caché transporte l'ID, mais ne constitue jamais une autorisation. Retour et Annuler conduisent au Portfolio ; le breadcrumb est contextualisé.

Les textes historiques du formulaire sont conservés, sans refonte éditoriale de cette page.

## D–H. Autorisation, écriture et navigation

`getWorkspacePortfolioContext` vérifie id + ownerId + statut ACTIVE et sélectionne uniquement id/nom. Il est appelé à l'affichage, puis à nouveau par l'action serveur avant la génération du slug et l'écriture.

- Portfolio étranger, absent ou archivé : refus, sans création ni allocation de slug.
- Paramètre fourni mais vide/non textuel, fichier ou répétition ambiguë : refus ; pas de conversion silencieuse en création globale.
- Paramètre absent : création globale avec portfolioId null et redirection historique `/gouvernance`.
- Paramètre autorisé : l'unique `workspace.create` porte déjà portfolioId. Aucun update de rattachement, aucun état intermédiaire sans Portfolio.
- Après création contextualisée : invalidation Mes espaces/Portfolio puis ouverture `/gouvernance/workspaces/[id]`. Le breadcrumb Workspace existant affiche le Portfolio réel.
- Portfolio archivé : menu de création absent ; l'action directe est également refusée.

Le refus d'un contexte invalide à l'affichage suit `notFound`. Les erreurs de mutation conservent les exceptions serveur ; une frontière d'erreur locale présente un message avec role=alert, Réessayer et Mes espaces, sans exposer le détail technique de l'exception.

## I. Nom existant

Un slug déjà occupé entraîne le choix d'un autre slug et la création d'un nouvel objet. Tests dans les deux modes, avec faux update/upsert qui échouent s'ils sont appelés. Aucun Workspace historique n'est réactivé ni réaffecté. La dette du flux de création de parcours gouverné reste intacte.

## J–K. Boussole et sécurité

Procédure de maintenance consultée. Aucun guide spécifique à la création Workspace n'existait : la route héritait du guide de collection Gouvernance. Elle est maintenant explicitement exclue de ce guide inadapté, avec ou sans paramètre Portfolio. Aucun nouveau micro-parcours ni changement supplémentaire de journeyVersion en 2B.

Le menu contextualisé réutilise le mécanisme natif de divulgation existant. Les guides Portfolio de 2A restent distincts ; aucun portfolioId n'est ajouté au contexte ou à la progression Boussole de création, et aucune création n'est automatisée.

L'autorisation vient de la session et de la lecture serveur, jamais de l'URL, du champ caché ou du menu React. Un test simule l'archivage entre affichage et soumission et vérifie le refus à la seconde validation.

## L–N. Tests 2A + 2B

- 9 nouveaux tests 2B : flux autorisé, refus/manipulations, mode global, noms existants, affichage autorisé, nouvelle vérification après archivage, menu, contexte et annulation, Boussole/erreur accessible.
- 216 tests concernés réussis au total : 2A, 2B, Mes espaces, Workspace, créations, Portfolio, navigation, ConnectedShell, durcissement UX-01A et Boussole.
- Maintenance Boussole complète : 55 tests réussis.
- Chrome à 320, 390, 768, 1024 et 1440 px : entrée par le menu Portfolio, nom long lisible, contexte transmis à la soumission simulée, validations natives, clavier/focus, mode global sans contexte, absence d'overflow. Régressions 2A et contrôles shell/Workspace conservés.
- Le harnais tient compte des changements de query string sur une même route. Captures mobile/desktop inspectées ; artefacts dans le dossier temporaire système.
- Tests serveur avec Prisma simulé et composants réels ; le harnais Chrome simule le transport Next. Pas de création en base ni de recette Preview revendiquée.
- TypeScript sans émission : uniquement les diagnostics QA connus TS2352 (`candidate-form-safety:28`) et TS7023 (`matching-lifecycle:27`). UTF-8 et `git diff --check` conformes.

## O. Build

Compilation applicative réussie, puis échec connu `Property 'get' does not exist on type 'FormData'` dans `app/api/documents/upload/route.ts:128`. Avertissements de cache webpack également présents. `tsconfig.tsbuildinfo` restauré après le contrôle. Aucune correction de cette dette.

## P–Q. Diff et réserves

2B ajoute le helper de validation Portfolio, le composant du formulaire, sa frontière d'erreur, les tests et ce rapport. Il adapte la page de création, son action serveur, le menu existant, la vue Portfolio 2A, le breadcrumb, l'exclusion Boussole et les tests/harnais concernés.

L'état combiné 2A + 2B reste non commité. Prisma, réactivation historique, moteur Piloter et les autres actions Workspace restent inchangés. `m1a/`, logs et captures sont hors lot. Aucun push ni développement UX-01D.

Réserves : recette humaine avec sessions, base et routeur Next réels à effectuer ; dette build et limites 2A de chargement des listes conservées. Le comportement historique de création globale et son retour Mes espaces restent inchangés.

UX-01C.2 COMPLET :
- [ ] prêt pour revue avant commit/Preview
- [x] prêt avec réserves
- [ ] bloqué
