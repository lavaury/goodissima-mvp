# Réconciliation du parcours gouverné — R0 / R1-A / R1-B / R1-C1 / R1-C2 / R1-C3 / R2-B / R2-C / R3 / R4

## Statut

R4 rend les mémoires gouvernées autorisées dans le cockpit canonique, immédiatement sous le bloc R3. La lecture reste exhaustive sur les `SOURCE` directement rattachées au GJ et les `FACT`/`DECISION` explicitement reliés à ces sources, sans filtre de statut. Les restrictions mémoire gagnent sur l'accès owner au cockpit. Les états, provenances et validations sont projetés sans identifiants techniques, sans confusion avec le journal et sans aucune mutation ou IA.

R3 raccorde l'extension technique au cockpit canonique `/gouvernance/parcours/[FormTemplate.id]/pilotage` par un bloc purement read-only. Il expose seulement la date de création, la version source exacte, le nombre de contextes dossier explicites et la disponibilité structurelle du journal legacy. Les parcours historiques sans extension restent lisibles sans création automatique. Les routes GJ-4 restent 404; aucune mémoire, événement, mutation ou nouvelle identité produit n'est introduite. La mémoire gouvernée visible est reportée à R4.

R2-C3 transporte deux `requestKey` distinctes générées pendant le rendu serveur : une pour le formulaire manuel et une pour l'assistant. Chaque clé reste stable pendant les retries et révisions de la même intention, notamment après « Reprendre le besoin », sans être affichée ni persistée hors de la page. Une nouvelle navigation ou un refresh produit une nouvelle paire. Aucun contrat Boussole ou `journeyVersion` ne change; une validation humaine Preview reste requise.

R2-C2 active le protocole serveur d'idempotence. Une `requestKey` UUID v4 normalisée est obligatoire; le serveur construit un scope Workspace canonique puis un fingerprint SHA-256 du payload validé, incluant le demandeur et conservant l'ordre des listes. Aucun fingerprint client n'est accepté.

Le serveur recherche d'abord une requête complétée strictement limitée au demandeur. Une récupération exige le même fingerprint et le même scope, ainsi qu'un Workspace toujours `ACTIVE`, possédé par le demandeur, et une chaîne Workspace/RT/FT/GJ cohérente. Une même clé avec un autre payload ou Workspace produit un conflit sans révéler la création antérieure.

À la première création, la réservation vide, toutes les écritures R2-B et la complétion tout-ou-rien partagent une transaction `Serializable`. Le GJ reste la dernière création métier et la complétion est l'écriture technique finale. Un rollback retire donc aussi la réservation. Les conflits `P2002` ciblant la clé d'idempotence et les conflits `P2034` sont résolus avec au plus deux exécutions transactionnelles et un jitter borné; aucun état « en cours » ni boucle de retry n'est ajouté.

R2-C2 et R2-C3 forment désormais le protocole fonctionnel complet : le serveur exige et protège la clé, tandis que les deux interfaces la transportent. Ils doivent être déployés ensemble avant validation utilisateur. Les tests concurrents PostgreSQL réels restent réservés à R2-C4.

R2-C1 ajoute uniquement la structure persistante vide `GovernedJourneyCreationRequest`. Elle sépare le protocole technique d'idempotence des identités métier `RelationTemplate`, `FormTemplate` et `GovernedJourney`. Une future clé UUID représentera une intention humaine de création et un futur fingerprint SHA-256 sera calculé côté serveur; aucune de ces valeurs n'est encore produite ou consommée dans R2-C1.

La structure autorise une réservation temporaire entièrement vide de références résultat, puis une complétion tout-ou-rien vers le Workspace, le RT, le FT et le GJ. R2-C2 devra effectuer réservation, création et complétion dans une transaction unique. R2-C1 ne modifie ni l'action de création ni l'UI et ne crée aucune ligne, y compris pour les parcours historiques.

Les références complétées utilisent `RESTRICT` et sont conservées aussi longtemps que le parcours existe; aucun TTL, nettoyage ou purge automatique n'est introduit. La table est protégée par RLS sans policy publique et reste réservée aux services serveur. Cette protection ne remplacera pas la future autorisation applicative owner-scoped, notamment lorsque le rôle serveur dispose de `BYPASSRLS`.

R2-C1 est couvert par des tests structurels locaux. En l'absence de base PostgreSQL jetable dédiée dans ce lot, les CHECK et les cinq FK devront être validés sur staging avant le commit de livraison, sans y créer de donnée métier.

R2-B crée désormais l'extension technique uniquement lors de la validation humaine finale d'un nouveau parcours depuis `/gouvernance/nouveau`. Le `Workspace`, le `RelationTemplate`, le `FormTemplate`, ses champs, la version source exacte et le `GovernedJourney` sont écrits dans la même transaction; un échec de l'extension annule l'ensemble. Aucun parcours historique n'est repris.

L'extension R2 porte `relationCaseId = null`, l'autorité issue du propriétaire du Workspace actif, et l'identifiant exact du `TemplateVersion` créé dans cette transaction. Son `title` est une copie non canonique de `FormTemplate.name` au moment de la création, sans synchronisation future. Son statut `DRAFT` est un état technique du ledger, jamais le statut métier du cockpit.

R2-B ne crée aucun événement initial, contexte dossier, mémoire, invitation, session, notification ou communication. Il ne déclenche aucune transition et ne modifie aucune route produit. Le cockpit demeure identifié par `FormTemplate.id`; l'idempotence de double soumission et de retry post-commit reste explicitement différée à R2-C.

Ce document fixe la doctrine transitoire initiée en R0 et le lien structurel minimal décidé en R1-A. Il prévaut sur toute formulation antérieure qui présenterait `GovernedJourney` comme une seconde instance métier ou comme la racine opérationnelle déjà utilisée par le produit. Aucun modèle Prisma n'est renommé dans R1-A.

R1-A ancre au plus une extension `GovernedJourney` sur un `RelationTemplate` grâce à l'unicité de `relationTemplateId`. `FormTemplate.id` reste l'identité UI transitoire du cockpit. Le lien historique `relationCaseId` devient facultatif et ne participe plus à l'autorité : `authorityUserId` reste obligatoire, directement lié à `User.id`, sans être contraint au propriétaire d'un dossier.

Ce lot ne crée aucune extension. Le lifecycle GJ reste inerte et non synchronisé, aucune table multi-dossier n'est ajoutée avant R1-C, et aucune mémoire propre au parcours n'est implémentée.

R1-B réaligne la projection interne sur cette identité structurelle sans modifier Prisma. Le lookup principal part de `RelationTemplate.id`; une résolution secondaire part de `FormTemplate.id` et suit son `relationTemplateId`. Toutes deux exigent un Workspace `ACTIVE` dont le demandeur est le propriétaire. L'absence d'extension reste normale avant R2 et ne déclenche aucune création.

R1-C1 ajoute la structure persistante vide `GovernedJourneyRelationCase`. Un contexte signifie seulement qu'un dossier participe explicitement au périmètre d'une extension. Les FK composites garantissent que le dossier et le GJ partagent le même `RelationTemplate`. La table ne reçoit aucun backfill et restera vide jusqu'aux futures commandes humaines de R1-C3. `createdByUserId` est une trace d'auteur, jamais une autorité ou une permission.

R1-C2 fournit uniquement des lectures internes par `RelationTemplate.id` et par résolution de `FormTemplate.id`. Elles autorisent via le Workspace exact, `ACTIVE` et possédé par le demandeur. Pour un ancrage autorisé, un GJ absent ou sans contexte produit une liste vide. Elles ignorent entièrement `GovernedJourney.relationCaseId`, ne créent aucun contexte et n'exposent aucune donnée métier du dossier.

R1-C3 ajoute uniquement `attachRelationCaseContext`. Cette commande interne exige une extension existante, un dossier portant exactement le même `RelationTemplate`, le même Workspace explicite et le même propriétaire, avec un Workspace `ACTIVE`. Elle utilise toujours le demandeur comme `createdByUserId`, sans accepter d'auteur arbitraire. Une répétition exacte est idempotente et ne modifie ni l'auteur ni la date initiale.

## Définition canonique

Dans Goodissima, un **parcours gouverné** est l'instance opérationnelle visible et pilotée dans le cockpit historique. Son identité UI transitoire est `FormTemplate.id`, sa racine relationnelle est `RelationTemplate`, sa définition versionnée est portée par `TemplateVersion`, et son périmètre organisationnel est le `Workspace` référencé par `RelationTemplate.workspaceId`.

Le cockpit canonique unique est :

```text
/gouvernance/parcours/[id]/pilotage
```

Dans cette route, `[id]` est un `FormTemplate.id`. Dans ce flux opérationnel, `FormTemplate` ne doit pas être décrit comme un simple template abstrait : il porte l'identité utilisée par l'interface et les actions du cockpit pendant la transition.

## Vocabulaire canonique

| Terme | Sens retenu pendant la transition |
| --- | --- |
| Parcours gouverné | Instance opérationnelle du cockpit historique |
| Définition du parcours | Éléments portés par `FormTemplate`, `RelationTemplate` et `TemplateVersion` |
| Version du parcours | `TemplateVersion` |
| Extension de journal et de mémoire | `GovernedJourney`, tant que la réconciliation n'est pas faite |
| Journal gouverné | `GovernedJourneyEvent` |
| Mémoire gouvernée | Modèles `GovernedMemory*` |

Les formulations « parcours `GovernedJourney` », « second parcours » et « parcours du dossier » pour désigner `GovernedJourney` sont ambiguës et interdites dans la documentation produit. Est également interdite toute formulation laissant croire que `FormTemplate` n'est qu'un template abstrait dans ce flux opérationnel.

## Rôle transitoire de GovernedJourney

`GovernedJourney` est une extension technique facultative rattachable structurellement à un unique `RelationTemplate`. Il peut constituer à terme un journal et un contexte de provenance pour la mémoire gouvernée. Il ne doit jamais être présenté comme un second parcours métier.

Avant R1/R2, le cockpit ne crée automatiquement aucun `GovernedJourney`. Avant décision produit, aucun statut opérationnel n'est synchronisé avec son lifecycle. Avant R1/R3, aucune lecture GJ n'est réactivée dans l'interface produit.

## Frontières

- **Opérationnel** : création, identité UI, définition, participants, invitations, documents attendus, communications et pilotage du vrai parcours dans le cockpit.
- **Journal de gouvernance** : événements append-only `GovernedJourneyEvent`; ils ne pilotent pas encore le statut opérationnel.
- **Mémoire gouvernée** : faits, décisions, sources, relations, validations, contestations et droits `GovernedMemory*`, produits uniquement par leurs commandes explicites.
- **Projection de lecture** : lookup interne unitaire de l'extension par `RelationTemplate`, résolution depuis `FormTemplate`, sans autorité propre et sans écriture métier. `ledgerStatus` décrit uniquement l'état technique transitoire du ledger.

Un événement opérationnel ou un événement du journal gouverné ne devient jamais automatiquement une mémoire probante. Une promotion en mémoire doit rester explicite, autorisée et traçable.

## Sources de vérité actuelles

| Domaine | Source de vérité actuelle | Frontière |
| --- | --- | --- |
| Identité | `FormTemplate.id` | Opérationnel/UI |
| Titre | `FormTemplate` et plan de création versionné affiché par le cockpit | Opérationnel |
| Workspace | `RelationTemplate.workspaceId` | Organisationnel |
| Définition/version | `TemplateVersion` rattachée au `RelationTemplate` | Opérationnel/versionné |
| Participants | Plan versionné et objets opérationnels dédiés du cockpit | Opérationnel |
| Invitations | `GovernedJourneyInvitation` rattachée au `RelationTemplate` | Opérationnel |
| Documents attendus | Définition versionnée et objets de réception dédiés | Opérationnel |
| Communications | `CommunicationSession` et participants de réunion dédiés | Opérationnel |
| Statut opérationnel | État lu et calculé par le cockpit historique | Opérationnel |
| Journal | `GovernedJourneyEvent`, extension technique non réconciliée | Journal uniquement |
| Mémoire | Modèles `GovernedMemory*` | Mémoire uniquement |
| Permissions | Contrôles du cockpit pour l'opérationnel; rôles et grants mémoire pour la mémoire; scope propriétaire/dossier provisoire pour GJ | Chaque frontière conserve sa propre autorité |

Aucun domaine ne possède deux propriétaires concurrents : `GovernedJourney` et son lifecycle ne remplacent aucune source opérationnelle avant une décision explicite de réconciliation.

## Incompatibilité actuelle

Depuis R1-A, `GovernedJourney.relationCaseId` est facultatif et hérité du modèle case-scoped initial. Il ne définit plus l'identité de l'extension ni son autorité. Les événements GJ restent toutefois temporairement case-scoped : un GJ sans dossier ne peut pas recevoir ces événements legacy avant la réconciliation dédiée de R1-C/R2. Le parcours opérationnel peut ainsi exister sans extension et l'extension globale peut exister sans dossier, sans qu'une représentation multi-dossier soit encore introduite.

Depuis R1-B, aucune liste principale par dossier n'est exposée. La lecture legacy des événements est séparée, autorisée via `RelationTemplate.workspace`, et indisponible explicitement lorsque l'extension n'a pas de `relationCaseId`. Elle ne constitue pas un journal global.

R1-C1 ne modifie ni ces événements, ni les tables mémoire, ni leurs FK historiques. Un contexte n'est pas une preuve mémoire et n'autorise aucune promotion. `GovernedJourney.relationCaseId` reste inchangé jusqu'à la réconciliation du journal et de la provenance prévue en R1-C5. Aucune ligne legacy n'est transformée en contexte.

R1-C2 n'élargit aucune lecture d'événement ou de mémoire. La présence d'un contexte n'accorde aucun droit sur le dossier, ses sources, pièces, participants, invitations, communications, sessions ou contacts. L'autorisation de lecture porte sur la racine `RelationTemplate → Workspace`; un contexte persisté n'est pas masqué si le Workspace explicite du dossier change ultérieurement. Cette cohérence sera vérifiée uniquement par les commandes humaines de R1-C3.

L'attachement R1-C3 ne produit aucun événement, aucune mémoire, invitation, session, notification ou synchronisation. Il ne modifie ni le GJ, ni le dossier, ni `GovernedJourney.relationCaseId`. Aucun retrait n'est disponible avant une conception séparée de son audit, et aucune UI ou route publique n'appelle la commande.

## Gel architectural

- aucune interface GJ parallèle n'est autorisée;
- les routes case-scoped GJ-4 restent neutralisées par un 404 immédiat;
- aucune redirection vers le cockpit n'est permise sans mapping 1:1;
- aucun backfill ou rapprochement par titre, Workspace, date ou proximité technique;
- aucun statut concurrent ni synchronisation automatique;
- aucune donnée de démonstration pour fabriquer un rattachement;
- aucun usage produit de `GovernedJourney` avant la réconciliation structurelle.

Le test `qa/governed-journey-reconciliation-boundaries.test.ts` matérialise ce gel. Il devra être révisé explicitement, avec la documentation et la décision d'architecture correspondantes, lorsque R1, R2 ou R3 autorisera un changement de frontière.

## Plan R0 à R6

- **R0 — terminologie et gel** : fixer la doctrine, les sources de vérité et les garde-fous statiques.
- **R1 — réconciliation structurelle** : R1-A garantit l'unicité `RelationTemplate` → extension; R1-B aligne les lookups internes sur `RelationTemplate` et le Workspace; R1-C1 fournit la table vide de contextes same-template; R1-C2 ajoute ses lectures internes; R1-C3 ajoute l'attachement humain explicite et idempotent; R1-C5 traitera le champ legacy et la dette des événements case-scoped.
- **R2 — création atomique** : R2-B crée l'extension des nouveaux parcours dans la transaction opérationnelle, sans double identité ni événement initial; R2-C traitera l'idempotence réseau et la concurrence de soumission.
- **R3 — intégration lecture/journal** : intégrer la lecture et le journal au vrai cockpit, sans interface parallèle.
- **R4 — promotions mémoire explicites** : définir les promotions autorisées, humaines, probantes et auditables.
- **R5 — parcours historiques** : traiter humainement les rattachements historiques disposant de preuves suffisantes.
- **R6 — retrait des identités et interfaces parallèles** : supprimer les compatibilités transitoires devenues inutiles.

## Registre des décisions

### Décisions figées

- vrai parcours = cockpit opérationnel;
- identité transitoire = `FormTemplate.id`;
- Workspace = `RelationTemplate.workspaceId`;
- cockpit canonique unique;
- mémoire indépendante des invitations;
- aucun backfill automatique;
- aucun statut concurrent;
- aucune UI GJ parallèle.

## R5-I1 — fondation de création mémoire

R5-I1 ajoute uniquement les contrats Prisma/PostgreSQL de portée et d'idempotence. `REGISTER_SOURCE` existe sans grant et sans utilisation; `GovernedMemoryCreationRequest` reste vide et non branché. Les commandes historiques résolvent `relationTemplateId` depuis leur `RelationCase`, tandis que les futures commandes cockpit seront directement journey-scoped. Aucun écran parallèle, automatisme ou changement R4 n'est introduit.

R5-I2a ajoute la racine `RelationTemplate` au journal mémoire, rend ses scopes dossier et parcours facultatifs et impose qu'au moins l'un soit présent. Le backfill est strictement structurel depuis les dossiers historiques; aucun `GovernedJourney` n'est inféré. `REGISTER_SOURCE` est attribué uniquement aux rôles `RELATION_CASE_OWNER`, `MEMORY_STEWARD` et `MEMORY_DELEGATE`; `VIEW_SOURCES` reste distinct et le contrôle historique ne sera remplacé qu'en R5-I2b. Aucune commande journey-scoped, idempotence branchée ou UI n'est livrée ici.

### Décisions ouvertes après R1-A

- `GovernedJourney` conserve-t-il un lifecycle ou devient-il un ledger pur ?
- quelle autorité remplace le propriétaire du `RelationCase` ?
- comment représenter une mémoire de parcours sans dossier obligatoire ?
- comment gérer un parcours couvrant plusieurs `RelationCase` ?
- quelles données historiques peuvent être rattachées humainement ?
- quelles promotions mémoire sont autorisées ?
