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

`GovernedJourneyEvent` est protégé en base contre `UPDATE` et `DELETE` par le trigger `GovernedJourneyEvent_append_only`, exécuté `BEFORE UPDATE OR DELETE`, et la fonction `reject_governed_journey_event_mutation()`.

`GovernedMemoryEvent` est protégé selon la même convention par le trigger `GovernedMemoryEvent_append_only`, exécuté `BEFORE UPDATE OR DELETE`, et la fonction dédiée `reject_governed_memory_event_mutation()`. Les deux fonctions lèvent une erreur explicite et ne prévoient aucune exception pour le runtime applicatif. `INSERT` et `SELECT` restent possibles sous réserve des permissions SQL et RLS ordinaires.

Ces protections sont hors du DSL Prisma. Toute migration future touchant l'une de ces tables doit vérifier explicitement dans le catalogue PostgreSQL que le trigger et sa fonction sont toujours installés ; un `prisma migrate diff` nul ne suffit pas à le démontrer.

## Discipline de réconciliation

Une vérification de schéma doit utiliser une cible explicitement identifiée et comparer le datamodel à cette cible avec `prisma migrate diff`. Un diff nul confirme le mapping Prisma ; il ne contrôle pas à lui seul la conservation des objets hors DSL listés ci-dessus.

## Consentement au Parcours

Une invitation, un consentement explicite, un droit d'accès et une participation à une réunion sont quatre objets distincts. `GovernedJourneyInvitation` transporte l'invitation et son accès historique ; `GovernedJourneyConsent` porte la décision explicite ; `GovernedMeetingParticipant` porte l'autorisation de participer à une réunion.

Le champ historique `GovernedJourneyInvitation.acceptedAt` reste un marqueur de première consultation du lien. Il ne constitue pas une preuve de consentement. Pour les invitations antérieures à la fondation persistante, l'absence de ligne `GovernedJourneyConsent` se projette comme `LEGACY_UNKNOWN` sans ajouter cette valeur à l'enum stockée.

`decidedByUserId` reste nullable : les transitions futures peuvent être attribuées à un acteur système ou externe sans compte `User`. L'identité et la nature de l'acteur sont conservées séparément dans le journal ; la contrainte SQL impose seulement la cohérence entre le statut et `decidedAt`.

`GovernedJourneyConsentEvent` est append-only au niveau PostgreSQL. Le trigger `GovernedJourneyConsentEvent_append_only` refuse tout `UPDATE` ou `DELETE`, tandis que les nouveaux événements restent insérables.
