# Persistance de la mémoire gouvernée — MG-2

> **Statut R0 — réconciliation des parcours.** Le cockpit historique fondé sur `FormTemplate.id` reste l'unique interface produit du parcours gouverné; `GovernedJourney` n'est pas encore sa racine opérationnelle. Une provenance GJ existante est un contexte technique et ne prouve pas le rattachement au vrai parcours. GJ-4 reste neutralisé et aucune réactivation n'est autorisée avant R1/R3. Voir `../governed-journey/GOVERNED_JOURNEY_RECONCILIATION.md`.

## Périmètre

MG-2 persiste, gouverne et reconstruit temporellement la mémoire d’un unique `RelationCase`, sans moteur IA ni interface. Sont persistés : faits, décisions, sources, relations typées, validations, contestations, droits, événements et affectations d’autorité. Les synthèses, inférences générées, embeddings, prompts et conversations mémoire restent absents.

## Audit et ancrage

`RelationCase` est la frontière forte de scope. Chaque table MG-2 possède `relationCaseId` et une FK `ON DELETE RESTRICT`. `User` porte les acteurs humains et `Representation` les acteurs ou sujets optionnels. Les couples `(authorRepresentationId, authorUserId)` d’un fait et `(actorRepresentationId, actorUserId)` d’un événement référencent `(Representation.id, Representation.ownerId)`. Une représentation événementielle appartient donc nécessairement à l’acteur humain attribué.

`Document`, `Message`, `FormSubmission` et `RelationEvent` restent des objets métier externes : une source ne copie pas leur contenu. Leur existence et leur `caseId` sont contrôlés transactionnellement à l’enregistrement. `GoodissimaIdentity`, invitations, sessions et `AuditLog` ne reçoivent aucune relation automatique et ne deviennent pas une preuve par leur seule existence.

Le conflit avec d’éventuelles suppressions historiques de `RelationCase` est assumé : dès qu’une mémoire existe, PostgreSQL refuse la suppression physique. Un futur lot devra proposer une clôture/anonymisation gouvernée plutôt qu’une cascade.

## Provenance GovernedJourney

Une `GovernedMemorySource` peut porter, uniquement lors de sa création explicite, zéro ou un `GovernedJourney` et zéro ou un `GovernedJourneyEvent`. Un événement implique toujours son parcours. Des FK composites garantissent que la source, le parcours et l’événement appartiennent au même `RelationCase`, et que l’événement appartient au parcours indiqué. Les suppressions restent `RESTRICT`.

Cette provenance est distincte de la nature de la source, ne confère aucun rôle, aucune permission et aucune autorité, et ne déclenche aucune transition. Un événement de parcours reste une preuve de changement d’état, jamais une mémoire automatique. Le service n’expose aucune mutation ultérieure de ces liens.

Les sources antérieures restent sans provenance GJ. Aucun rattachement n’est déduit d’un dossier, template, formulaire, `RelationEvent`, invitation, session ou rapprochement temporel, et la migration n’effectue aucun backfill.

## Schéma

- `GovernedMemoryFact` : version temporelle d’un énoncé, auteur et établissement humain.
- `GovernedMemoryDecision` : brouillon mutable puis contenu immuable après validation.
- `GovernedMemorySource` : référence minimale, cycle de vie et colonnes dédiées pour extrait privé.
- `GovernedMemoryRelation` : arête typée et unique entre objets du même dossier.
- `GovernedMemoryValidation` : appréciation humaine append-only.
- `GovernedMemoryDispute` : ouverture historique puis résolution conditionnelle explicite.
- `GovernedMemoryAccessGrant` : droit temporel explicite avec résiduel optionnel borné.
- `GovernedMemoryEvent` : trace append-only, distincte d’un fait.
- `GovernedMemoryRoleAssignment` : responsable ou délégataire explicite et révocable.

`VALIDATED_SYNTHESIS` reste une valeur du vocabulaire de source pour compatibilité MG-1, mais MG-2 ne fournit ni modèle de synthèse ni service autorisant son enregistrement.

## Relations génériques : choix et limite

MG-2 conserve `GovernedMemoryRelation` afin de respecter le contrat conceptuel MG-1. PostgreSQL garantit son scope `RelationCase`, l’unicité exacte, l’absence d’auto-référence et les couples type/source/cible autorisés. Seuls `SUPPORTED_BY`, `DERIVED_FROM`, `REPLACES`, `CORRECTS`, `CANCELS` et `COMPLEMENTS` sont persistables. `CONTESTS`, `VALIDATES` et `SUMMARIZES` restent dans l’enum conceptuel mais sont refusés par la contrainte MG-2. Les extrémités polymorphes ne peuvent toutefois pas recevoir une FK native vers trois tables différentes.

Le repository vérifie donc transactionnellement l’existence et le scope des objets lorsque la relation est produite. La détection des cycles et sa robustesse en concurrence restent applicatives ; elles ne sont pas garanties par une contrainte SQL. Un futur modèle à tables ciblées pourra renforcer ces garanties si les usages se stabilisent.

## Temporalité

Les lectures suivent la règle `recordedAt <= T`. Les lectures d’état ajoutent `effectiveFrom <= T` et `effectiveUntil IS NULL OR effectiveUntil > T`. Une information rétroactive peut être applicable en janvier mais ne pas être connue avant son enregistrement en avril.

Les listes utilisent un ordre déterministe et une limite maximale de 100. Les grants sont actifs seulement si leur début est atteint, leur fin non atteinte et leur révocation non intervenue à T.

## Transitions et transactions

- proposer un fait crée le fait et `FACT_PROPOSED` dans la même transaction ;
- établir un fait effectue une mise à jour optimiste, ajoute une validation humaine et `FACT_ESTABLISHED` ;
- remplacer un fait crée la nouvelle version, ferme l’ancienne et ajoute relation/événement atomiquement ;
- valider une décision exige encore `DRAFT`, écrit validation et événement ;
- une décision validée ne possède aucun repository de modification ; toute évolution crée un successeur relié ;
- enregistrer/promouvoir une source, accorder/révoquer un droit et ouvrir/résoudre une contestation écrivent leur événement dans la transaction.

Un échec lève ou retourne un conflit avant confirmation. Prisma annule alors toutes les écritures de la transaction.

Une contestation `WITHDRAWN` est une clôture historisée : `resolvedAt`, `resolvedByUserId` et un motif non vide dans `resolution` sont obligatoires. Seul l’auteur de la contestation ou une autorité mémoire explicitement habilitée peut effectuer ce retrait.

## Droits persistés

Les rôles `MEMORY_STEWARD` et `MEMORY_DELEGATE` sont historisés. Un index partiel autorise un seul responsable actif par dossier et empêche les affectations actives dupliquées. Le propriétaire du dossier conserve uniquement les permissions de base définies par MG-1 ; il n’obtient pas implicitement le contenu des sources restreintes.

Le résolveur combine rôle actif et grants actifs. Une source restreinte exige en plus un grant ciblant son identifiant. Un dossier bloqué n’accorde aucun fallback. Un grant révoqué ou expiré ne produit aucun droit courant. Pour les grants comme pour les rôles, `revokedAt` et `revokedByUserId` sont strictement tous deux nuls ou tous deux renseignés. Le résiduel est représenté par permission, date limite et base dédiées, toutes obligatoires ensemble, et ne peut exister sans révocation.

La reconstruction historique complète des rôles et droits n’est pas encore un moteur produit ; MG-2 expose seulement les lectures minimales à T.

## Promotion des messages privés

La promotion accepte uniquement un message existant dans le même `RelationCase`, un extrait de 1 à 2 000 caractères, une finalité, une base de consentement fermée et une visibilité `PRIVATE_TO_AUTHOR` ou `RESTRICTED:<policy>`. Le corps complet du message n’est jamais copié ni modifié. Aucun import ou déclenchement automatique n’existe.

## Suppression logique

Les sources passent par `ARCHIVED`, `RESTRICTED`, `EXPIRED`, `ANONYMIZED`, `DELETED` ou `LEGAL_HOLD`. `DELETED` et `ANONYMIZED` exigent une raison d’indisponibilité. Aucun repository ne supprime physiquement un objet de mémoire. Les sources indisponibles restent citables par leur trace minimale, pas consultables comme contenu disponible.

## Intégrité SQL

La migration ajoute :

- intervalles temporels valides ;
- cohérence des statuts et dates ;
- texte borné/non vide pour les champs structurants ;
- sujet User/Representation exclusif ;
- acteur système sans usurpation ;
- promotion humaine complète des extraits ;
- auto-références interdites ;
- cohérence User/Representation des acteurs événementiels par FK composite ;
- symétrie stricte des dates et acteurs de révocation ;
- clôture `WITHDRAWN` entièrement historisée ;
- unicités de relations et de rôles actifs ;
- index temporels, de scope, statut et cible ;
- FKs structurantes `RESTRICT` ;
- RLS activé sans policy navigateur.

La connexion Prisma staging précédemment auditée dispose de `BYPASSRLS`. La migration n’a pas été exécutée dans MG-2.

## Immutabilité réelle

L’application n’expose aucun update/delete d’événement ou de validation et aucun delete d’objet mémoire. Les décisions validées et faits remplacés sont protégés par des mutations conditionnelles. Les événements et validations sont append-only dans le repository.

Aucun trigger SQL d’immutabilité n’est ajouté, le dépôt n’utilisant pas ce pattern. Un accès SQL privilégié peut donc encore modifier directement une ligne : l’immutabilité est applicative, renforcée par certains `CHECK`, mais pas absolue au niveau SQL.

## Sécurité

Toutes les recherches d’objet mémoire utilisent `relationCaseId`; les identifiants polymorphes sont vérifiés dans la transaction. Les services dérivent l’acteur de leur argument authentifié et n’acceptent pas un validateur/promoteur arbitraire. Les erreurs stables ne contiennent ni stack, secret, contenu source ni détail Prisma. Aucune lecture ou écriture cross-case n’est autorisée.

## Absence d’IA et d’interface

MG-2 n’ajoute aucune API, page, composant, assistant, synthèse, génération, embedding, recherche vectorielle ou mutation automatique d’objet métier. Boussole ne reçoit ni cible ni étape ; `journeyVersion` reste inchangée.

## Risques et lots futurs

- renforcer les extrémités polymorphes avec des tables ciblées si leur vocabulaire devient stable ;
- ajouter une politique persistante structurée de visibilité plutôt qu’une `policyRef` ;
- tester les courses sur une base PostgreSQL réelle après déploiement contrôlé ;
- définir la clôture, anonymisation et conservation juridique d’un `RelationCase` ;
- ajouter éventuellement des triggers d’immutabilité après décision d’architecture ;
- construire plus tard une reconstruction historique des droits complète, indépendante de toute synthèse.
