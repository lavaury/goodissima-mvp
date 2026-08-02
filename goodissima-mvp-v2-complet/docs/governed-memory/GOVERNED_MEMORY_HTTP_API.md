# MG-4 — API HTTP interne de mémoire gouvernée

## Périmètre

MG-4 expose exclusivement les six lectures MG-3 par des Route Handlers Next.js internes et authentifiés. Il n'ajoute ni écriture, ni interface, ni IA, ni endpoint public. `RelationCase` reste l'unique frontière de mémoire.

## Architecture et authentification

Le chemin d'une requête est : route GET → enveloppe no-store → session Supabase vérifiée → résolution read-only de l'utilisateur applicatif → parseur strict → service MG-3 → enveloppe JSON.

`getCurrentUser()` utilise `supabase.auth.getUser()` côté serveur. La session doit porter une adresse confirmée. Le schéma applicatif ne conservant pas l'identifiant Supabase, MG-4 résout ensuite l'utilisateur existant par l'adresse normalisée issue de cette session signée. Aucune adresse fournie par la query, un header ou un body n'est acceptée. L'absence de session, d'adresse vérifiée ou d'utilisateur applicatif correspondant produit `401` sans création automatique de compte.

Les routes n'importent ni Prisma, ni repository MG-2, ni résolveur de permissions. Elles transmettent l'identifiant interne dérivé au service MG-3, qui résout `VIEW_MEMORY`, `VIEW_SOURCES` et les grants ciblés dans son snapshot `RepeatableRead`.

## Contrats communs

Succès :

```json
{"ok":true,"data":{},"meta":{"requestId":"9a99b5a3-2466-47bd-83d2-835caf731443","generatedAt":"2026-08-03T10:00:00.000Z"}}
```

Échec :

```json
{"ok":false,"error":{"code":"NOT_FOUND","message":"La ressource demandée est introuvable."},"meta":{"requestId":"ce2627a5-bff7-4b03-90b4-33a9e65042da"}}
```

`requestId` est un UUID technique sans contenu métier. Les DTO MG-3 contiennent des dates ISO 8601 et aucune valeur Prisma brute. Les collections conservent leur ordre déterministe et les curseurs MG-3 restent opaques.

## Routes

### État à une date

`GET /api/internal/relation-cases/{relationCaseId}/governed-memory/state`

Paramètres obligatoires : `referenceDate`, `knowledgeMode`. Paramètres optionnels : `include`, `limit`, `cursor`. `limit` est compris entre 1 et 200.

```text
GET .../state?referenceDate=2026-08-01T00:00:00Z&knowledgeMode=KNOWN_AT_DATE&include=FACTS,DECISIONS&limit=50
```

```json
{"ok":true,"data":{"relationCaseId":"case_demo","referenceDate":"2026-08-01T00:00:00.000Z","facts":[],"decisions":[],"limitations":[],"redactions":[],"pagination":{"nextCursor":null}},"meta":{"requestId":"7bcaf051-b1e2-4cc9-aebb-8be927e27b54","generatedAt":"2026-08-03T10:00:00.000Z"}}
```

### Comparaison

`GET /api/internal/relation-cases/{relationCaseId}/governed-memory/compare`

Paramètres : `from`, `to`, `knowledgeMode`, et éventuellement `include`. Les modes acceptés sont `KNOWN_AT_EACH_DATE` et `CURRENT_KNOWLEDGE_ABOUT_PERIOD`.

```text
GET .../compare?from=2026-07-01T00:00:00Z&to=2026-08-01T00:00:00Z&knowledgeMode=KNOWN_AT_EACH_DATE
```

```json
{"ok":true,"data":{"period":{"from":"2026-07-01T00:00:00.000Z","to":"2026-08-01T00:00:00.000Z"},"changes":{"factsAdded":[]},"limitations":[],"redactions":[]},"meta":{"requestId":"e787ef88-d6c5-450a-950f-d515b47d85e2","generatedAt":"2026-08-03T10:00:00.000Z"}}
```

### Explication structurée d'une décision

`GET /api/internal/relation-cases/{relationCaseId}/governed-memory/decisions/{decisionId}/explanation`

`referenceDate` est optionnel. La réponse distingue le motif déclaré, les faits et sources liés, les décisions antérieures, conséquences, contestations, limitations et occultations. Aucun récit n'est généré.

```text
GET .../decisions/decision_demo/explanation?referenceDate=2026-08-01T00:00:00Z
```

```json
{"ok":true,"data":{"decision":{"id":"decision_demo","declaredRationale":"Motif enregistré"},"explicitSupportingFacts":[],"explicitSupportingSources":[],"limitations":[],"redactions":[]},"meta":{"requestId":"24f5e857-df78-4328-85fe-74d5dbdb3c4f","generatedAt":"2026-08-03T10:00:00.000Z"}}
```

### Reconstruction d'accès

`GET /api/internal/relation-cases/{relationCaseId}/governed-memory/access`

`referenceDate` et exactement l'un de `subjectUserId` ou `subjectRepresentationId` sont obligatoires. MG-3 limite l'exploration d'un autre sujet aux requesters disposant de `MANAGE_MEMORY_ACCESS`.

```text
GET .../access?referenceDate=2026-08-01T00:00:00Z&subjectUserId=user_demo
```

```json
{"ok":true,"data":{"subject":{"type":"USER","id":"user_demo"},"activeRoles":[],"activeGrants":[],"residualGrants":[],"revokedGrants":[],"limitations":[]},"meta":{"requestId":"2816db99-87ab-4599-92d1-1615d94204cb","generatedAt":"2026-08-03T10:00:00.000Z"}}
```

### Timeline

`GET /api/internal/relation-cases/{relationCaseId}/governed-memory/timeline`

Paramètres obligatoires : `from`, `to`. Paramètres optionnels : `limit`, `cursor`, `include=TIMELINE`. La plage porte sur `occurredAt`, avec `from` inclusif et `to` exclusif (`[from, to)`). La route valide et transmet ces valeurs à MG-3 sans filtrage local.

MG-3 applique le scope, la plage et l'occultation des événements de sources invisibles avant l'ordre `occurredAt ASC, id ASC`, le curseur et `limit + 1`. Le curseur appartient donc exclusivement à la collection visible de cette plage. `recordedAt` reste fourni séparément pour représenter la date de connaissance.

```text
GET .../timeline?from=2026-07-01T00:00:00Z&to=2026-08-01T00:00:00Z&limit=100
```

```json
{"ok":true,"data":{"timeline":[],"limitations":[],"redactions":[],"pagination":{"nextCursor":null}},"meta":{"requestId":"3800f66f-44a0-49c1-baa7-f71b409db525","generatedAt":"2026-08-03T10:00:00.000Z"}}
```

### Trace d'un objet

`GET /api/internal/relation-cases/{relationCaseId}/governed-memory/objects/{objectType}/{objectId}/trace`

`objectType` vaut exclusivement `FACT`, `DECISION` ou `SOURCE`. `referenceDate` est optionnel.

```text
GET .../objects/FACT/fact_demo/trace?referenceDate=2026-08-01T00:00:00Z
```

```json
{"ok":true,"data":{"relations":[],"validations":[],"disputes":[],"events":[],"limitations":[]},"meta":{"requestId":"d77366ee-0638-4694-959c-873272573bbb","generatedAt":"2026-08-03T10:00:00.000Z"}}
```

## Validation et erreurs

Les paramètres inconnus ou dupliqués sont refusés. Les identifiants sont non vides et bornés à 191 caractères, les curseurs à 2048 caractères, les dates sont des UTC ISO 8601 strictes et normalisées, les enums sont exacts, les includes sont uniques et bornés.

| Situation | Statut | Code public |
|---|---:|---|
| Session absente ou utilisateur non résolu | 401 | `UNAUTHENTICATED` |
| Paramètre ou plage invalide | 400 | `INVALID_REQUEST` |
| Objet absent, cross-case ou inaccessible | 404 | `NOT_FOUND` |
| Graphe incohérent | 409 | `INCONSISTENT_MEMORY_GRAPH` |
| Erreur inattendue | 500 | `INTERNAL_ERROR` |

`FORBIDDEN` MG-3 est volontairement aplati en `404`. Aucune stack, erreur Prisma, règle d'autorisation ou donnée privée n'est renvoyée.

## Cache, CORS et journalisation

Chaque route utilise `dynamic = "force-dynamic"`, `revalidate = 0`, `unstable_noStore()` et `Cache-Control: private, no-store, max-age=0, must-revalidate`. Aucun cache partagé n'est autorisé.

Aucun header CORS permissif n'est ajouté : la politique same-origin et les cookies de session restent applicables. MG-4 n'ajoute aucun log afin d'éviter les contenus privés, queries et curseurs. Le `requestId` est disponible dans la réponse pour une future corrélation technique sûre.

Le dépôt ne fournit actuellement aucun rate limiter commun. MG-4 s'appuie donc sur les bornes MG-3 et ses parseurs stricts ; l'ajout d'une protection distribuée cohérente reste un risque opérationnel documenté, pas une implémentation locale incomplète.

## Occultations et sécurité

Les occultations `FULLY_HIDDEN` et `EXISTENCE_DISCLOSED` sont produites par MG-3 et transmises sans réinterprétation. La route ne calcule aucun compteur métier, ne recharge aucune relation et n'enrichit aucun objet. Les objets inaccessibles ou cross-case partagent le même statut et message public. Les routes n'exposent aucune méthode autre que GET et n'importent aucun service d'écriture.

## Hors périmètre

Interface React, navigation, Boussole visible, mutation, export, endpoint public, IA, synthèse, langage naturel, embeddings, OpenAPI, modification Prisma et migration sont hors MG-4. Aucun `journeyVersion` ne change.
