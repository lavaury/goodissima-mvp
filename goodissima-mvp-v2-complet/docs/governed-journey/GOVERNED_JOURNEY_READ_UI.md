# Gel de l'interface de lecture GJ-4

> **Statut R0.** `GovernedJourney` n'est pas encore la racine opérationnelle. Les lectures décrites ici sont des briques internes non exposées; leur provenance éventuelle ne démontre aucun rattachement au vrai parcours opérationnel. Aucune réactivation n'est autorisée avant R1/R3. La doctrine canonique est définie dans `GOVERNED_JOURNEY_RECONCILIATION.md`.

L'interface GJ-4 est temporairement neutralisée. Le cockpit historique fondé sur `FormTemplate` et `RelationTemplate`, accessible sous `/gouvernance/parcours/[FormTemplate.id]/pilotage`, reste l'unique interface produit des parcours gouvernés.

Les routes case-scoped `/cases/[caseId]/journeys` et `/cases/[caseId]/journeys/[journeyId]` retournent immédiatement une réponse 404. Elles n'authentifient aucun utilisateur, n'effectuent aucune lecture et ne rendent aucun composant. La page dossier ne présente plus de section ni de lien vers ces routes.

## Brique de lecture interne conservée

Le read model GJ-4 est conservé comme brique interne non exposée. Son repository vérifie le couple dossier/propriétaire avant toute lecture. La liste est triée par `updatedAt DESC, id DESC` et utilise un curseur keyset opaque (20 éléments par défaut, 50 maximum). La fiche et ses événements sont lus dans une transaction `RepeatableRead`; chaque requête porte à la fois le dossier et le parcours. Une absence, un dossier étranger ou un parcours étranger produisent le même code stable `NOT_FOUND`.

Les DTO ne contiennent ni version interne, ni étape courante, ni autorité ou acteur, ni motif, ni identifiant d'événement ou de modèle. Les objets Prisma bruts ne franchissent pas la couche de service.

## Compteur mémoire différé

`visibleMemorySourceCount` vaut actuellement `null`. Aucun prédicat canonique et réutilisable ne permet encore de compter exactement les sources visibles avec les mêmes règles que l'interface mémoire. Un comptage local aurait dupliqué une règle de sécurité susceptible de diverger; son ajout est donc différé jusqu'à l'extraction de cette politique de visibilité.

## Réconciliation requise

Il n'existe pas encore de relation 1:1 établie entre un `GovernedJourney` case-scoped et le `FormTemplate` du cockpit historique. Le gel n'introduit donc aucune redirection, aucun rapprochement automatique et aucune correspondance implicite entre ces objets. Une réactivation volontaire de GJ-4 dépendra de la réconciliation structurelle R1/R3 et d'une décision produit explicite.

## Boussole

Le retrait de la zone GJ-4 ne modifie aucune cible Boussole existante, notamment `case-relational-navigation`. Il ne change ni les états `EMPTY`, `POPULATED`, `FOCUSED`, ni l'ordre ou la signification d'une étape existante; aucune évolution de `journeyVersion` n'est requise.
