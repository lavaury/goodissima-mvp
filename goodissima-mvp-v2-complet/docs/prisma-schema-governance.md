# Gouvernance du schéma PostgreSQL et Prisma

Le fichier `prisma/schema.prisma` représente le catalogue PostgreSQL utilisé par Prisma, mais il ne constitue pas la totalité de la gouvernance de la base.

PostgreSQL conserve des objets que Prisma 5.22 ne représente pas complètement : contraintes `CHECK`, index uniques partiels, politiques et activation RLS, triggers, fonctions SQL et index spécialisés, notamment vectoriels. Leur absence du DSL Prisma ne signifie ni qu'ils sont obsolètes ni qu'ils peuvent être supprimés.

Toute future migration Prisma doit être inspectée manuellement, SQL compris, avant application. L'inspection doit notamment refuser toute suppression ou recréation involontaire :

- des contraintes métier `CHECK` ;
- des index partiels ou vectoriels ;
- de l'activation RLS et de ses éventuelles policies ;
- des triggers et fonctions de protection ;
- des tables représentées uniquement pour fidélité du stockage, sans runtime actif.

Les modèles `RelationalSubject`/IDRU, Representation/Contacts, GovernedJourney, GovernedMemory et `goodissima_*` présents dans Prisma ne réactivent aucune fonctionnalité. Ils documentent et rendent accessible la structure déjà présente en base.

## Append-only

`GovernedJourneyEvent` est protégé en base contre `UPDATE` et `DELETE` par le trigger `GovernedJourneyEvent_append_only` et sa fonction SQL associée.

`GovernedMemoryEvent` ne possède pas encore de protection SQL équivalente. Tant que la dette `MEM-EVENT-APPEND-01` n'est pas résolue par une migration explicitement revue, aucune mutation runtime de ce journal ne doit être ouverte sur la seule foi d'une convention applicative.

## Discipline de réconciliation

Une vérification de schéma doit utiliser une cible explicitement identifiée et comparer le datamodel à cette cible avec `prisma migrate diff`. Un diff nul confirme le mapping Prisma ; il ne contrôle pas à lui seul la conservation des objets hors DSL listés ci-dessus.
