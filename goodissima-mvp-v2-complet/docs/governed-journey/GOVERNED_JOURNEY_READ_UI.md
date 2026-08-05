# Lecture R3 dans le cockpit canonique

> **Statut R3.** `GovernedJourney` n'est pas la racine opérationnelle. R3 raccorde une synthèse strictement read-only au cockpit fondé sur `FormTemplate.id`; les routes GJ-4 restent neutralisées. La doctrine canonique est définie dans `GOVERNED_JOURNEY_RECONCILIATION.md`.

L'interface GJ-4 est temporairement neutralisée. Le cockpit historique fondé sur `FormTemplate` et `RelationTemplate`, accessible sous `/gouvernance/parcours/[FormTemplate.id]/pilotage`, reste l'unique interface produit des parcours gouvernés.

## Bloc cockpit R3

Le bloc « Gouvernance du parcours » présente l'extension technique dans le vrai cockpit, sans navigation ni action supplémentaire. Une extension présente affiche sa date de création, la version exacte de `createdFromTemplateVersion`, le seul nombre de contextes explicites et la disponibilité structurelle du journal legacy. Les événements ne sont pas chargés et l'absence de `relationCaseId` legacy est décrite comme un journal global non encore activé.

Un parcours historique sans extension reste supporté avec un état neutre. R3 ne crée aucune extension, aucun contexte, aucun événement et aucun backfill. Le DTO du composant exclut le statut ledger, l'autorité, les identifiants dossier, le fingerprint et la clé d'idempotence. Les lectures restent limitées au `Workspace` actif possédé par le demandeur. La mémoire gouvernée visible est prévue pour R4; R3 ne lit aucune mémoire.

## Mémoire cockpit R4

R4 ajoute sous ce bloc une section « Mémoire gouvernée », toujours dans le cockpit canonique. Elle projette exhaustivement les sources directement rattachées à l'extension et les faits ou décisions explicitement reliés à ces sources. Aucun état persistant n'est filtré arbitrairement : l'état réel reçoit un libellé humain et une indication d'activité distincte. Les restrictions `VIEW_MEMORY`, `VIEW_SOURCES` et les grants ressource restent prioritaires et les éléments invisibles ne participent pas au compteur.

Le journal et la mémoire restent séparés. R4 ne charge pas le journal complet; seul l'horodatage d'un événement source explicitement lié peut décrire la provenance. Une validation n'est affichée que lorsqu'une ligne `GovernedMemoryValidation` la prouve. Aucune mémoire, validation, relation ou provenance n'est créée ou reconstruite. Les parcours sans extension et les extensions sans mémoire possèdent des états neutres dédiés.

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

Le bloc R3 est informatif et reste hors séquence guidée. Il ne supprime, renomme ou déplace aucune cible existante et ne change ni les états `EMPTY`, `POPULATED`, `FOCUSED`, ni la signification d'une étape; aucune évolution de `journeyVersion` n'est requise. Une validation humaine Preview reste obligatoire.
