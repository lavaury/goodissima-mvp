# Réconciliation du parcours gouverné — R0 / R1-A

## Statut

Ce document fixe la doctrine transitoire initiée en R0 et le lien structurel minimal décidé en R1-A. Il prévaut sur toute formulation antérieure qui présenterait `GovernedJourney` comme une seconde instance métier ou comme la racine opérationnelle déjà utilisée par le produit. Aucun modèle Prisma n'est renommé dans R1-A.

R1-A ancre au plus une extension `GovernedJourney` sur un `RelationTemplate` grâce à l'unicité de `relationTemplateId`. `FormTemplate.id` reste l'identité UI transitoire du cockpit. Le lien historique `relationCaseId` devient facultatif et ne participe plus à l'autorité : `authorityUserId` reste obligatoire, directement lié à `User.id`, sans être contraint au propriétaire d'un dossier.

Ce lot ne crée aucune extension. Le lifecycle GJ reste inerte et non synchronisé, aucune table multi-dossier n'est ajoutée avant R1-C, et aucune mémoire propre au parcours n'est implémentée.

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
- **Projection de lecture** : DTO internes GJ et mémoire, sans autorité propre et sans écriture métier.

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
- **R1 — relation structurelle 1:1** : R1-A garantit l'unicité `RelationTemplate` → extension; R1-C traitera les contextes dossier et la dette des événements case-scoped.
- **R2 — création atomique** : créer le lien et les éventuelles briques GJ dans la transaction opérationnelle, sans double identité.
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

### Décisions ouvertes après R1-A

- `GovernedJourney` conserve-t-il un lifecycle ou devient-il un ledger pur ?
- quelle autorité remplace le propriétaire du `RelationCase` ?
- comment représenter une mémoire de parcours sans dossier obligatoire ?
- comment gérer un parcours couvrant plusieurs `RelationCase` ?
- quelles données historiques peuvent être rattachées humainement ?
- quelles promotions mémoire sont autorisées ?
