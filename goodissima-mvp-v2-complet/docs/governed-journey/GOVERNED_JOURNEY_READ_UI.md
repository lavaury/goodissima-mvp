# Consultation des parcours gouvernés

La consultation GJ-4 est réservée au propriétaire du `RelationCase` et s'exécute exclusivement dans des Server Components. Elle expose une liste paginée, une fiche de synthèse et l'historique ordonné des événements. Elle ne fournit aucune API publique et n'ajoute aucune commande métier.

## Contrat de lecture

Le repository vérifie le couple dossier/propriétaire avant toute lecture. La liste est triée par `updatedAt DESC, id DESC` et utilise un curseur keyset opaque (20 éléments par défaut, 50 maximum). La fiche et ses événements sont lus dans une transaction `RepeatableRead`; chaque requête porte à la fois le dossier et le parcours. Une absence, un dossier étranger ou un parcours étranger produisent le même code stable `NOT_FOUND`.

Les DTO ne contiennent ni version interne, ni étape courante, ni autorité ou acteur, ni motif, ni identifiant d'événement ou de modèle. Les objets Prisma bruts ne franchissent pas la couche de service.

## Compteur mémoire différé

`visibleMemorySourceCount` vaut actuellement `null`. Aucun prédicat canonique et réutilisable ne permet encore de compter exactement les sources visibles avec les mêmes règles que l'interface mémoire. Un comptage local aurait dupliqué une règle de sécurité susceptible de diverger; son ajout est donc différé jusqu'à l'extraction de cette politique de visibilité.

## Boussole

La zone affiche uniquement des objets réels et n'est pas une nouvelle cible Boussole. Elle ne modifie ni les états `EMPTY`, `POPULATED`, `FOCUSED`, ni l'ordre ou la signification d'une étape existante; aucune évolution de `journeyVersion` n'est requise.
