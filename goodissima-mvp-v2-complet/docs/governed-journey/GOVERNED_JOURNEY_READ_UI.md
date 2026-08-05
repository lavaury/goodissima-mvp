# Gel de l'interface de lecture GJ-4

> **Statut R1-B.** `GovernedJourney` n'est pas la racine opérationnelle. Les lectures décrites ici sont des briques internes non exposées, désormais ancrées sur `RelationTemplate` et autorisées par son `Workspace`. Aucune réactivation n'est autorisée avant R3. La doctrine canonique est définie dans `GOVERNED_JOURNEY_RECONCILIATION.md`.

L'interface GJ-4 est temporairement neutralisée. Le cockpit historique fondé sur `FormTemplate` et `RelationTemplate`, accessible sous `/gouvernance/parcours/[FormTemplate.id]/pilotage`, reste l'unique interface produit des parcours gouvernés.

Les routes case-scoped `/cases/[caseId]/journeys` et `/cases/[caseId]/journeys/[journeyId]` retournent immédiatement une réponse 404. Elles n'authentifient aucun utilisateur, n'effectuent aucune lecture et ne rendent aucun composant. La page dossier ne présente plus de section ni de lien vers ces routes.

## Brique de lecture interne R1-B

La lecture principale est un lookup unitaire par `RelationTemplate.id`. Une résolution pratique part de `FormTemplate.id`, suit exclusivement `FormTemplate.relationTemplateId`, puis lit l'extension singulière facultative. Elle n'utilise jamais `GovernedJourney.formTemplateId`. Le titre de la résolution provient uniquement de `FormTemplate.name`.

Chaque lookup exige le `workspaceId` attendu et le propriétaire demandeur. Le `RelationTemplate` doit appartenir à ce Workspace, dont le propriétaire doit être le demandeur et le statut `ACTIVE`. Un objet absent, étranger, sans Workspace ou dans un Workspace inactif produit le même code stable `NOT_FOUND`. Une racine autorisée sans extension retourne normalement `null` : aucune extension n'est créée automatiquement avant R2.

La projection `InternalGovernedJourneyLedgerView` contient seulement les identifiants techniques nécessaires, le contexte dossier legacy nullable, `ledgerStatus`, `createdAt` et `updatedAt`. `ledgerStatus` est un état technique transitoire du ledger, jamais le statut métier du parcours opérationnel. Le titre GJ, les dates lifecycle, l'autorité, la version, l'étape courante et les données Prisma brutes ne sont pas exposés.

R1-B ne fournit aucune liste globale ou par dossier, aucune pagination et aucun compteur mémoire. Les droits mémoire, invitations, sessions et participants ne confèrent aucun accès à cette lecture.

## Événements legacy

La lecture d'événements est séparée du lookup principal. Elle autorise d'abord l'extension via `RelationTemplate` et son Workspace actif, puis exige le `relationCaseId` legacy exact. Les événements restent triés par `sequence ASC` et n'exposent ni motif, ni acteur, ni autorité. Une extension sans dossier retourne `LEGACY_EVENT_LOG_UNAVAILABLE` : cette API ne prétend pas fournir un journal global complet.

## Réconciliation requise

R1-A a établi l'unicité de l'extension par `RelationTemplate`; R1-B aligne uniquement sa lecture interne. Le gel n'introduit aucune redirection, création, synchronisation de statut ou correspondance implicite. Une intégration au cockpit dépendra de R3 et d'une décision produit explicite.

## Boussole

Le retrait de la zone GJ-4 ne modifie aucune cible Boussole existante, notamment `case-relational-navigation`. Il ne change ni les états `EMPTY`, `POPULATED`, `FOCUSED`, ni l'ordre ou la signification d'une étape existante; aucune évolution de `journeyVersion` n'est requise.
