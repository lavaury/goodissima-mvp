# Agrégat persistant de parcours gouverné — GJ-0

> **Statut R3 — lecture dans le cockpit canonique.** Le cockpit fondé sur `FormTemplate.id`, `RelationTemplate` et `TemplateVersion` reste l'unique interface et la racine opérationnelle du produit. R3 y rend visible une synthèse read-only de l'extension technique, sans réactiver GJ-4, sans reprendre l'historique et sans ajouter de mutation.

## Présentation cockpit R3

Le read model cockpit résout le `FormTemplate`, son `RelationTemplate` et l'extension facultative à travers un `Workspace` `ACTIVE` possédé par le demandeur. Il projette la date de création, la version exacte liée par `createdFromTemplateVersion`, le nombre de `GovernedJourneyRelationCase` explicites et la présence d'un journal legacy compatible. Il ne charge aucun événement et ne lit aucune mémoire. Le composant ne reçoit ni statut ledger, ni autorité, ni identifiant dossier ou technique.

L'absence d'extension sur un ancien parcours est un état normal et n'entraîne ni création, ni backfill. L'absence de contexte legacy indique seulement que le journal global n'est pas encore activé. La mémoire gouvernée visible est prévue pour R4. Le bloc étant informatif et hors séquence Boussole, les `journeyVersion` restent inchangés sous réserve de validation humaine Preview.

## Requêtes de création idempotentes

`GovernedJourneyCreationRequest` est un protocole technique distinct des identités métier. Sa future clé UUID désignera une intention humaine de création et son fingerprint SHA-256 sera calculé uniquement par le serveur à partir du payload validé. R2-C1 n'en transporte, calcule, réserve ou complète encore aucune instance.

Depuis R2-C2, la clé UUID v4 est une précondition serveur et le fingerprint SHA-256 est construit sur un objet canonique incluant le demandeur, le scope Workspace, les valeurs validées et la provenance IA normalisée. Les tableaux conservent leur ordre. Les dates, IDs générés, clés métier aléatoires et valeurs structurelles clientes sont exclus. Les fingerprints sont comparés en longueur constante avec `timingSafeEqual`.

Une requête complétée n'est récupérée qu'avec le même propriétaire, la même clé, le même fingerprint et le même scope. Le Workspace et les relations RT/FT/GJ sont revalidés; un Workspace archivé produit `NOT_FOUND`, tandis qu'une clé réutilisée avec un contenu différent produit `CREATION_CONFLICT`. La récupération retourne le même `FormTemplate.id` sans nouvelle écriture.

La réservation, le parcours opérationnel, le GJ et la complétion sont atomiques dans une transaction `Serializable`. `P2002` n'est traité comme collision idempotente que lorsqu'il vise l'unique demandeur/clé; `P2034` autorise une seule nouvelle tentative après un jitter de 20 à 50 ms. Deux exécutions transactionnelles au maximum sont possibles. Une erreur ou un rollback ne laisse aucune réservation persistée.

Depuis R2-C3, le rendu serveur génère une clé indépendante pour le formulaire manuel et pour l'assistant. L'assistant conserve sa clé pendant toute l'intention, y compris après « Reprendre le besoin ». Les clés ne sont ni visibles, ni dérivées du contenu ou de l'utilisateur, ni régénérées par l'action finale. R2-C2 et R2-C3 doivent être déployés ensemble. Le contrat Boussole reste inchangé et nécessite une validation humaine Preview. Les doubles de transaction couvrent le protocole localement; les scénarios réellement concurrents sur PostgreSQL restent à valider en R2-C4.

La table accepte deux formes seulement : une réservation sans aucune référence résultat et une requête complétée portant simultanément le Workspace, le `RelationTemplate`, le `FormTemplate`, le `GovernedJourney` et `completedAt`. Le CHECK SQL exclut tout état partiel. R2-C2 devra garder la réservation et la complétion dans la transaction opérationnelle afin qu'une réservation inachevée ne soit jamais observable après commit.

Les références sont nullable pour permettre cette réservation transactionnelle, mais toutes leurs FK utilisent `RESTRICT`. Une requête complétée est conservée aussi longtemps que le parcours existe; R2-C1 n'ajoute ni TTL, purge, statut, payload JSON, retry ou donnée historique. RLS est activée sans policy publique. La table est destinée aux services serveur et la future récupération restera obligatoirement limitée au propriétaire authentifié, indépendamment d'un éventuel `BYPASSRLS` du rôle serveur.

## Pourquoi un nouvel agrégat

`RelationTemplate`, `FormTemplate` et `TemplateVersion` décrivent une définition réutilisable. Jusqu'à GJ-0, le cockpit appelait « parcours » un `FormTemplate` et lisait son plan dans `TemplateVersion.snapshot.metadata.creationPlan`. Un `RelationTemplate` pouvant alimenter plusieurs `RelationCase`, aucun de ces objets ne représente une instance appartenant à un dossier précis.

`GovernedJourney` prolonge techniquement la racine opérationnelle sans créer une seconde identité. Sa hiérarchie R1-C1 est :

```text
FormTemplate (identité UI) ─── RelationTemplate (racine structurelle)
                                      │ 0..1
                                      └── GovernedJourney (extension technique)
                                      │ 0..n
                                      └── GovernedJourneyRelationCase
                                             └── RelationCase (contexte explicite, non identitaire)
```

Un template partagé ne confère aucun accès aux dossiers qui l'utilisent.

## Cardinalités, propriétaire et autorité

- une extension appartient à exactement un `RelationTemplate`, qui ne peut porter qu'une extension ;
- `relationCaseId` reste un contexte historique facultatif conservé jusqu'à R1-C5 pour le journal et la provenance legacy ;
- `GovernedJourneyRelationCase` représente uniquement la participation explicite d'un dossier au périmètre de l'extension ;
- les deux FK composites garantissent en SQL que le GJ et le dossier partagent le même `RelationTemplate` ;
- `createdByUserId` trace l'auteur d'une future liaison explicite mais ne lui confère aucune autorité ;
- le vrai parcours et ses dossiers peuvent exister sans extension ;
- la version source reste une provenance figée de l'extension lorsqu'elle sera créée ;
- `ownerId` désigne le propriétaire institutionnel ou technique du dossier ;
- `authorityUserId` désigne conceptuellement l'autorité humaine gouvernant le parcours ;
- depuis R1-A, l'autorité n'est plus contrainte à être le propriétaire du dossier ;
- `authorityUserId` conserve une FK simple obligatoire vers `User.id` ;
- toutes les relations structurantes utilisent `ON DELETE RESTRICT`.

Le service de création GJ reste inchangé et case-scoped jusqu'à R2; il ne doit pas être appelé par le cockpit dans R1-A. La future autorité ne sera déduite ni de `metadata.createdById`, ni d'une invitation, ni d'une `CommunicationSession`. Un mécanisme d'affectation explicite devra historiser la nomination, la révocation et leur auteur. Un simple accès au dossier ne devra jamais suffire.

La table de contextes R1-C1 reste vide jusqu'à R1-C3. Elle n'accorde aucune permission, ne prouve aucune provenance mémoire et ne déclenche ni événement, transition, création d'extension ou synchronisation. Aucun `relationCaseId` legacy n'y est recopié.

R1-C2 expose deux lectures internes, l'une par `RelationTemplate.id`, l'autre par résolution de `FormTemplate.id`. Elles exigent le Workspace exact, actif et possédé par le demandeur. Pour un ancrage autorisé, l'absence de GJ ou de contexte est représentée par une liste vide; aucune création ou reprise legacy n'est tentée. La liste provient exclusivement de `GovernedJourneyRelationCase`, dans l'ordre `createdAt ASC, relationCaseId ASC`.

La projection contient uniquement les identifiants structurels et la date de création du contexte. Elle n'expose pas l'auteur, les données du dossier, le statut ou le titre GJ. Elle n'accorde aucun accès à la mémoire, aux pièces, participants, invitations, communications, sessions ou contacts. Un changement historique de `RelationCase.workspaceId` ne masque pas un contexte déjà persisté : R1-C2 autorise par la racine `RelationTemplate → Workspace`; les futures commandes R1-C3 porteront la cohérence du dossier au moment de l'attachement.

R1-C3 permet uniquement d'attacher un dossier existant à une extension existante. La commande exige le même `RelationTemplate`, le même Workspace explicite, le même propriétaire et un Workspace `ACTIVE`. Elle est `Serializable` et idempotente : une liaison exacte existante conserve son auteur et sa date et retourne `created = false`; une première création utilise toujours le demandeur comme `createdByUserId` et retourne `created = true`.

La commande ne crée jamais de GJ, n'écrit aucun événement ou objet mémoire, ne synchronise aucun statut et ne modifie pas `GovernedJourney.relationCaseId`. Elle ne fournit ni retrait, remplacement, import ou attachement multiple. Aucun droit mémoire ou dossier ne résulte de la liaison et aucune UI ou route publique ne l'expose.

## Définition figée à l'instanciation

Le parcours conserve :

- la version exacte dans `createdFromTemplateVersionId` ;
- son `relationTemplateId`, cohérent avec cette version par FK composite ;
- son `formTemplateId` facultatif ;
- un titre propre à l'instance.

GJ-0 n'ajoute pas de copie JSON supplémentaire. La définition historique est déjà portée par le snapshot versionné de `TemplateVersion`. Les modifications futures du template ne changent donc pas la version d'origine du parcours. Le lien optionnel `FormTemplate → RelationTemplate` ne peut pas être garanti par une FK composite Prisma sans dupliquer une clé nullable ; sa cohérence est vérifiée dans la transaction de création.

Participants attendus, documents, actions initiales et confidentialité restent pour ce lot dans le snapshot de définition. Leur transformation éventuelle en objets d'instance typés doit faire l'objet d'un lot distinct.

## Cycle de vie

Les statuts sont `DRAFT`, `ACTIVE`, `SUSPENDED`, `CLOSED` et `CANCELLED`. Une contrainte SQL vérifie les dates obligatoires ou interdites pour chaque état. `currentStepKey` est seulement un pointeur courant : il ne constitue ni un historique ni une preuve temporelle.

La matrice GJ-1 autorise uniquement :

```text
DRAFT     → ACTIVE       (ACTIVATED)
DRAFT     → CANCELLED    (CANCELLED)
ACTIVE    → SUSPENDED    (SUSPENDED)
ACTIVE    → CLOSED       (CLOSED)
ACTIVE    → CANCELLED    (CANCELLED)
SUSPENDED → ACTIVE       (RESUMED)
SUSPENDED → CANCELLED    (CANCELLED)
```

`CLOSED` et `CANCELLED` sont terminaux. Une clôture depuis `SUSPENDED` est interdite : le parcours doit être repris explicitement. La première activation fixe `startedAt`; une reprise ne la réécrit pas. Suspension, clôture et annulation utilisent la date explicite de leur commande.

Un motif humain, normalisé et limité à 500 caractères, est obligatoire pour suspendre ou annuler. Il reste facultatif pour activer, reprendre ou clôturer. Aucun snapshot ou JSON libre n'est accepté comme motif.

Chaque changement incrémente `GovernedJourney.version`. L'update SQL est conditionné par le parcours, le dossier, l'autorité, le statut source et la version attendue. La séquence de l'événement correspond à la nouvelle version. Deux commandes concurrentes ne peuvent donc pas gagner avec la même version.

Une commande répétée alors que son statut cible est déjà atteint est idempotente : elle retourne le parcours sans modifier sa version, ses dates ou son journal. Une autre commande incompatible reste une erreur `INVALID_TRANSITION`.

La création produit atomiquement un `GovernedJourneyEvent` de type `CREATED`, vers `DRAFT`, avec la séquence 1. Chaque transition produit exactement un événement dans la même transaction. La FK composite `(governedJourneyId, relationCaseId, authorityUserId)` empêche de journaliser une autre autorité ou un autre dossier. Un index unique garantit une seule occurrence par séquence.

Le journal est append-only à deux niveaux : aucun repository applicatif d'update/delete n'est exposé et un trigger PostgreSQL rejette tout `UPDATE` ou `DELETE`, y compris pour une connexion contournant RLS. Les insertions restent réservées aux transactions métier. RLS demeure activée sans policy navigateur permissive.

Le cycle du parcours est distinct de `RelationCase.governanceStatus`, du statut d'un `Workspace`, d'une invitation et d'une `CommunicationSession`. Une transition GJ-1 ne modifie aucun de ces objets et ne produit ni mémoire, notification, accès, invitation, session ou effet IA.

## Provenance mémoire facultative

GJ-2 permet à une `GovernedMemorySource` créée explicitement de référencer zéro ou un parcours et, facultativement, zéro ou un événement précis de ce parcours. Un event implique son journey. Les FK composites imposent le même `RelationCase`, l’appartenance de l’événement au parcours et des suppressions `RESTRICT`.

Le lien est fixé à la création de la source et ne confère aucune autorité, aucun rôle ni aucune permission. Il ne transforme jamais un `GovernedJourneyEvent` en mémoire, et aucune transition ne crée de source. Les sources historiques restent non rattachées : aucun dossier, template, formulaire, `RelationEvent`, invitation, session ou voisinage temporel ne constitue un backfill probant.

## Création transactionnelle

Le flux R2-B de `/gouvernance/nouveau` crée successivement le Workspace autorisé, le `RelationTemplate`, le `FormTemplate`, ses `FormField`, le `TemplateVersion`, puis le `GovernedJourney` comme dernière écriture métier de la même transaction. L'extension référence directement l'identifiant de cette version, sans recherche de dernière version après coup. Un échec à n'importe quelle étape annule toute la transaction, y compris la création éventuelle du Workspace.

L'autorité R2 est exclusivement `Workspace.ownerId`, après vérification que le Workspace est `ACTIVE` et possédé par le demandeur authentifié. Un Workspace inactif n'est jamais réactivé silencieusement. Le titre GJ copie `FormTemplate.name` comme snapshot non canonique de création; `FormTemplate.name` reste la source opérationnelle et aucune synchronisation n'est prévue.

Le GJ global R2 est créé en `DRAFT`, version 1, sans étape courante ni date lifecycle. Ce `DRAFT` est un état technique du ledger, distinct de tout statut métier du cockpit. Contrairement au service legacy case-scoped décrit ci-dessous, R2-B ne crée aucun événement `CREATED`, aucun contexte `RelationCase` et aucune transition. Il ne crée non plus aucune mémoire, invitation, session, notification ou communication. L'idempotence des retries et doubles soumissions appartient à R2-C.

`createGovernedJourney` vérifie successivement le dossier, son propriétaire, le formulaire éventuel, le template relationnel et l'appartenance de la version au template. Le parcours et son événement sont créés dans une transaction `Serializable`. Aucun template n'est modifié et aucun objet de mémoire gouvernée n'est créé.

La cohérence `formTemplateId/relationTemplateId` reste un contrôle transactionnel. Les cohérences dossier/autorité et template/version sont également garanties par SQL, en défense en profondeur.

## Reprise des parcours historiques

Une définition n'est jamais une instance. Même un `FormTemplate` ayant exactement un dossier possible et une seule version ne prouve pas qu'un parcours a réellement été créé ou exécuté.

L'audit des traces existantes n'a trouvé aucune preuve suffisante :

- `GovernedJourneyInvitation` peut viser un dossier, mais ce rattachement est facultatif, l'invitation ne désigne pas le `FormTemplate` et ne prouve pas la version instanciée ;
- `CommunicationSession` porte également des rattachements facultatifs et décrit une communication, pas la création certaine d'une instance ;
- les événements de dossier existants ne portent pas un contrat d'instanciation du parcours et de sa version ;
- les liens template/dossier expriment une possibilité d'utilisation, pas un fait historique.

La migration crée donc **zéro parcours historique** et n'invente ni date, ni autorité, ni événement `CREATED`.

Doivent être repris humainement ou par une future procédure explicite :

- templates liés à plusieurs dossiers ;
- templates sans dossier ;
- définitions avec plusieurs versions dont la version réellement instanciée n'est pas prouvable ;
- données de pure conception sans instance de dossier.

La migration ne crée pas de table temporaire de rapport. Une reprise future devra recueillir une preuve contrôlable du dossier, du template, de la version, de la date et de l'autorité, puis appeler une procédure d'instanciation dédiée. Elle ne pourra pas transformer l'unicité technique en preuve historique.

## Compatibilité du cockpit

Le cockpit existant continue d'utiliser son identifiant `FormTemplate`. Il n'est pas modifié et ne prétend pas recevoir un `GovernedJourneyId`. Une future transition devra introduire une route explicite d'instance ; aucune conversion silencieuse n'est faite dans GJ-0.

## Limites et suite

GJ-0 n'introduit ni interface, ni API, ni mémoire de parcours, ni orientation, ni IA, ni ingestion. Le service n'est pas encore appelé par le formulaire historique, car celui-ci ne choisit aucun `RelationCase`.

Avant MG-6A, les nouvelles instances devront être créées explicitement, les éventuelles instances historiques devront être reprises humainement avec preuve, et la doctrine d'affectation d'autorité non propriétaire devra être conçue si ce besoin devient réel. `GovernedJourney(id, relationCaseId)` fournira alors la base nécessaire aux FK composites de MG-6A.
