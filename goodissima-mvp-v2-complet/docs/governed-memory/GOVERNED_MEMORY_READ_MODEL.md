# Lecture et reconstruction de la mémoire gouvernée — MG-3

R5-IIIa1 ne modifie aucune projection visible R4. Il ajoute uniquement une lecture interne serveur des affectations journey-scoped actives, strictement cohérentes avec la même racine `RelationTemplate`; une affectation révoquée ou case-scoped n'est jamais substituée.

## Revalidation R5-II

Après chaque création humaine confirmée, le cockpit canonique est revalidé et R4 relit la base. Le compteur et les cartes ne reposent sur aucun objet optimiste ou temporaire. Les états affichés sont les états initiaux réels (`PROPOSED`, `DRAFT`, `ACTIVE`) et ne constituent jamais une validation humaine.

> **Statut R0 — réconciliation des parcours.** Le cockpit historique fondé sur `FormTemplate.id` reste l'unique interface produit du parcours gouverné; `GovernedJourney` n'est pas encore sa racine opérationnelle. La provenance GJ projetée par ce read model est un contexte interne et ne prouve pas le rattachement au vrai parcours. GJ-4 reste neutralisé et aucune réactivation n'est autorisée avant R1/R3. Voir `../governed-journey/GOVERNED_JOURNEY_RECONCILIATION.md`.

## Objectif et périmètre

MG-3 reconstruit, sans IA, l’état gouverné d’un unique `RelationCase`. Il répond à six requêtes structurées : état à une date, comparaison de périodes, explication d’une décision, reconstruction des accès, chronologie et trace d’un objet.

Les résultats sont des DTO déterministes. Ils ne constituent ni synthèse validée, ni interprétation, ni causalité. `generatedAt` est seulement l’instant technique du calcul.

## Audit du socle

MG-1 fournit le vocabulaire, les règles `wasKnownAt`/`wasEffectiveAt`, les permissions et les limitations conceptuelles. MG-2 fournit les faits, décisions, sources, relations, validations, contestations, grants, rôles et événements nécessaires aux lectures.

MG-2 proposait déjà des listes temporelles simples, mais pas de DTO de lecture, filtre central, pagination opaque, statut historique, comparaison ou trace groupée. MG-3 complète ces lacunes sans modifier Prisma ni les règles d’écriture.

Les limites persistantes sont importantes : certains changements de statut de source n’ont pas tous un événement dédié ; une relation polymorphe n’a pas de FK vers son extrémité ; aucun log gouverné ne prouve la consultation ; une conséquence enregistrée sur une décision n’est pas datée séparément ; les invitations et sessions ne prouvent rien. Ces lacunes produisent des limitations, jamais une approximation silencieuse.

## Architecture

- `read/types.ts` : entrées, DTO, changements, redactions et limitations.
- `read/repository.ts` : sélections case-scoped et groupées.
- `read/access-filter.ts` : filtre par les droits actuels.
- `read/state-builder.ts` : reconstruction temporelle.
- `read/comparison.ts` : différences structurées.
- `read/limitations.ts` : codes et messages bornés.
- `read/service.ts` : six cas d’usage publics du module.

Le repository n’utilise jamais le requester comme substitut au contrôle d’accès : le service résout d’abord les droits actuels, puis le repository charge uniquement le dossier demandé.

## Provenance facultative du parcours — GJ-3

Une source visible peut exposer `provenance: null` ou un contexte minimal composé du titre et du statut actuel du parcours, puis éventuellement du type, de la transition, de la séquence et de la date ISO de l’événement référencé. `currentStatus` décrit l’état courant du parcours ; `toStatus` décrit l’état atteint par l’événement historique. Aucun identifiant GJ, motif humain, acteur, autorité, template ou version interne n’est exposé.

La visibilité est strictement héritée de la source. Le filtre `VIEW_SOURCES` et les grants ciblés s’appliquent avant la collecte des références GJ. Les parcours et événements ne sont ensuite chargés que pour les sources visibles de la page, par deux requêtes groupées au maximum, toutes deux filtrées par `relationCaseId`. Zéro provenance visible produit zéro requête GJ ; plusieurs sources partageant un parcours ne le chargent qu’une fois.

La provenance est un contexte de source : elle ne crée ni mémoire, preuve, droit, autorité, transition, notification, invitation ou session. Elle ne permet aucune navigation vers le parcours. Une référence exceptionnellement indisponible conserve la source, retourne `provenance: null` et produit la limitation bornée `PROVENANCE_UNAVAILABLE`.

## Modes de connaissance

### `KNOWN_AT_DATE`

Seuls les éléments tels que `recordedAt <= referenceDate` sont chargés. L’état applicable exige également `effectiveFrom <= referenceDate` et une fin absente ou postérieure.

### `CURRENT_KNOWLEDGE_ABOUT_DATE`

Le cutoff de connaissance devient l’heure courante. Un élément effectif à la date demandée mais enregistré plus tard apparaît avec `knowledgeTiming: RECORDED_LATER` et `RETROACTIVE_INFORMATION`.

La comparaison propose les variantes `KNOWN_AT_EACH_DATE` et `CURRENT_KNOWLEDGE_ABOUT_PERIOD`. Les deux états sont construits séparément ; ils ne sont jamais mélangés silencieusement.

## État à une date

`getMemoryStateAt` charge dans une transaction : faits, décisions, sources, relations, validations, contestations, événements, grants et rôles. Le builder produit les vues demandées par `include`.

Le statut historique d’un fait utilise sa date d’établissement, les contestations ouvertes, la succession et l’effectivité du successeur. Le statut courant `SUPERSEDED` n’est donc pas automatiquement projeté dans le passé.

Pour une décision, `validatedAt` détermine le passage du brouillon à la validation. Une relation `REPLACES` ou `CORRECTS` devient succession lorsque le successeur est effectif ; `CANCELS` produit `CANCELLED`; `COMPLEMENTS` ne remplace jamais.

Les statuts `SOURCE_RESTRICTED` et `SOURCE_DELETED` sont datés par leurs événements. Les autres cycles de source peuvent produire `STATUS_HISTORY_INCOMPLETE` faute d’événement persistant complet.

## Comparaison de périodes

`compareMemoryPeriods` compare deux DTO déjà filtrés. Il distingue : apparition dans la connaissance, sortie de l’état effectif, changement, succession, annulation, restriction, contestation, grant et rôle.

Une sortie temporelle est nommée `FACT_BECAME_INAPPLICABLE`, jamais suppression. Chaque changement porte identifiant, type, date, avant/après, références de preuve disponibles et certitude `EXACT`, `RECONSTRUCTED` ou `INCOMPLETE`.

La comparaison ne voit jamais un objet intégralement masqué : celui-ci ne contribue ni aux compteurs ni aux changements retournés.

## Explication structurée d’une décision

`explainDecision` assemble uniquement : motif déclaré, décideur, validateur, dates, faits et sources explicitement reliés, décisions antérieures, réserves, validations, contestations, événements et conséquences enregistrées.

`declaredRationale`, `explicitSupportingFacts`, `explicitSupportingSources` et `laterConsequences` sont des champs distincts. Une source liée n’est pas transformée en motif et une conséquence n’est pas présentée comme cause. `CAUSALITY_NOT_ESTABLISHED` est toujours explicite.

## Reconstruction des accès

`reconstructAccessAt` exige exactement un User ou une Representation. Un utilisateur peut reconstruire son propre historique ; l’historique d’un autre sujet exige `MANAGE_MEMORY_ACCESS` aujourd’hui.

Le résultat sépare rôles actifs, grants actifs, résiduels, révoqués/expirés, permissions effectives et ressources restreintes. `ACCESS_NOT_EQUAL_TO_CONSULTATION` et `CONSULTATION_LOG_UNAVAILABLE` rappellent qu’un droit, une invitation ou une session ne prouve pas une consultation.

Un ancien droit n’autorise jamais cette lecture : `VIEW_MEMORY` courant est vérifié avant tout chargement.

## Filtrage actuel et redactions

Le filtre central s’exécute après la sélection case-scoped, avant la construction finale.

- `VIEW_MEMORY` courant est obligatoire.
- Les sources exigent `VIEW_SOURCES`.
- Une source restreinte exige en plus un grant ciblé.
- Responsable et délégataire ne contournent pas la restriction ciblée.
- `DELETED` et `ANONYMIZED` restent indisponibles.
- `FULLY_HIDDEN` ne révèle ni titre ni ID.
- `EXISTENCE_DISCLOSED` n’est utilisé que pour une policy qui l’autorise explicitement.

Les références et événements pointant vers une source cachée sont retirés. Une redaction entièrement cachée ne participe pas à la pagination visible ni aux compteurs.

## Limitations

Les limitations ont un code stable, une portée, un objet nullable, un message constant et une sévérité. Elles couvrent notamment source absente/redacted/indisponible, rétroactivité, histoire de statut incomplète, causalité, absence de log de consultation, contestation ouverte, référence polymorphe et limite de page.

Aucun message n’est composé à partir du titre ou du contenu d’une source privée.

## Pagination et performances

La limite par défaut est 50, le maximum 200 et la timeline 500. Le curseur base64url contient le couple stable `recordedAt/id`; les requêtes utilisent un keyset et l’ordre `recordedAt ASC, id ASC`. Les collections auxiliaires ont des plafonds explicites et déclenchent `PAGE_LIMIT_REACHED` si leur couverture est incomplète.

Les collections sont chargées par lots, sans requête par objet. Une trace de décision exécute un nombre constant de requêtes, indépendamment du nombre de relations.

La pagination d’état reste pilotée uniquement par les faits : son curseur n’est pas une pagination autonome des sources ou décisions. GJ-3 conserve volontairement cette limite préexistante et ne change ni curseur ni ordre.

## Cohérence de lecture

Chaque opération de lecture utilise une transaction Prisma unique au niveau d'isolation PostgreSQL `RepeatableRead`. L'existence et le scope du `RelationCase`, les représentations du requester, ses rôles actifs, ses grants globaux ou ciblés, les révocations, les expirations et les objets gouvernés sont lus avec le même client transactionnel. Les occultations et le résultat sont construits avant la fermeture de cette transaction.

Une seule horloge est capturée au début de l'opération. Elle détermine l'activité des rôles et grants, les expirations, les droits résiduels et `generatedAt`.

Une révocation commise avant le début du snapshot est visible et retire le droit correspondant. Une révocation concurrente commise après le début du snapshot peut ne pas modifier la requête déjà ouverte : c'est la sémantique normale de l'instantané `RepeatableRead`, et non une fenêtre entre contrôle et lecture. Cette autorisation de snapshot ne vaut jamais autorisation durable pour une requête ultérieure.

`compareMemoryPeriods` résout les droits actuels une seule fois et reconstruit les deux états dans la même transaction `RepeatableRead`. La comparaison est ainsi atomique par rapport au même snapshot d'autorisations et de données.

## Pagination de la timeline

`getMemoryTimeline` accepte explicitement `from`, `to`, `limit` et `cursor`. La timeline est fondée sur `occurredAt` : `from` est inclusif et `to` exclusif, soit l'intervalle `[from, to)`. `recordedAt` reste exposé séparément et sert seulement à empêcher la lecture d'un événement non encore connu à l'horloge de l'opération.

Dans le même snapshot `RepeatableRead`, la requête applique successivement le scope `RelationCase`, la plage `occurredAt`, le cutoff de connaissance, l'occultation des événements de sources invisibles, la position du curseur, l'ordre `occurredAt ASC, id ASC`, puis `limit + 1`. Le curseur encode uniquement `occurredAt` et l'identifiant du dernier événement visible retourné. Il n'est émis que lorsqu'un événement visible supplémentaire existe dans la plage.

## Sécurité

Chaque requête contient `relationCaseId`. Cross-case et accès absent retournent `NOT_FOUND`. Aucun modèle Prisma brut n’est exposé par les services. Les erreurs ne contiennent ni stack, secret, titre privé ni identifiant issu d’un objet masqué.

Le repository MG-3 contient exclusivement des `findUnique`/`findMany`. Aucune lecture n’écrit un audit, un événement ou un objet métier.

## Exemples

### 1. Où en étions-nous le 1er mars ?

Mode `KNOWN_AT_DATE`. Le résultat montre les faits enregistrés et effectifs au 1er mars, les décisions validées à cette date et les contestations alors ouvertes. Un fait de janvier enregistré le 15 mars est absent. Une source restreinte sans grant ciblé est `FULLY_HIDDEN`. Limitation : causalité non établie et éventuellement couverture incomplète.

### 2. Qu’est-ce qui a changé entre mars et juin ?

Mode `KNOWN_AT_EACH_DATE`. `changes` distingue un fait apparu, un ancien fait devenu inapplicable, une décision annulée, une contestation résolue et un grant révoqué. Une source entièrement cachée ne produit aucun changement visible. Aucun changement n’est décrit comme suppression physique sans événement `SOURCE_DELETED`.

### 3. Pourquoi la décision D a-t-elle été prise ?

Le motif déclaré est retourné séparément. Les faits et sources sont présents uniquement avec une relation explicite. Une source inaccessible devient redaction, sans titre. Une conséquence ultérieure reste dans `laterConsequences`. Limitations : source absente le cas échéant et causalité non établie.

### 4. Qui avait accès à la source S au 15 avril ?

La reconstruction liste grants, rôles et résiduels effectifs au 15 avril. Elle n’affirme pas que la source a été consultée. Si le requester ne peut actuellement connaître S, son identifiant est omis. Les anciennes permissions du requester ne lui rendent aucun accès courant.

## Hors périmètre et risques

Pas d’IA, synthèse narrative, recherche libre, embedding, index documentaire, interface, API, export, ingestion ou corrélation inter-dossiers. Aucun schéma ou migration n’est nécessaire.

Une validation PostgreSQL réelle reste requise pour mesurer l’isolation, la pagination et les courses permission/lecture. Les tests MG-3 sont unitaires et structurels ; ils ne remplacent pas cette validation. La reconstruction exacte de certains statuts nécessitera de futurs événements persistants dédiés.

## Boussole

MG-3 ne crée aucune page, étape, cible ou donnée produit. `journeyVersion` reste inchangée.
## Portée structurelle R5-I1

Une mémoire peut être globale au parcours : `relationTemplateId` est obligatoire, `RelationCase` est un contexte facultatif et `GovernedJourney` un rattachement direct facultatif, avec au moins l'un de ces deux scopes. Les objets historiques case-only restent valides et ne reçoivent aucun parcours artificiel. La projection visible R4 ne change pas dans R5-I1.

## Projection cockpit R4

R4 réutilise les règles d'accès mémoire courantes dans le cockpit canonique. L'accès au `FormTemplate` et au `Workspace ACTIVE` ne remplace jamais `VIEW_MEMORY`, `VIEW_SOURCES` ou un grant ressource plus strict. Les sources directement liées au `GovernedJourney` définissent le périmètre explicite; les faits et décisions doivent posséder une `GovernedMemoryRelation` vers l'une de ces sources.

R5-I2a ne modifie pas cette projection. Il rend seulement le journal mémoire structurellement compatible avec un événement case-scoped, journey-scoped ou contextualisé, toujours sous une racine `RelationTemplate` cohérente. La lecture directe R4 des futurs faits et décisions journey-scoped reste réservée à R5-I2b.

R5-I2b charge directement les faits, décisions et sources dont `governedJourneyId` désigne l'extension courante, tout en conservant les relations historiques vers les sources du dossier legacy. Les requêtes groupées fusionnent ces chemins par identité interne avant projection : un objet direct également relié ne produit qu'une carte et qu'une unité dans `visibleCount`. Le rattachement direct reçoit une provenance neutre d'enregistrement explicite; il n'est jamais présenté comme une validation. Aucun journal complet ni payload volumineux n'est chargé.

La projection ne filtre aucun état de fait, décision ou source. Les lignes supprimées logiquement ou anonymisées restent comptées lorsqu'elles sont autorisées, avec contenu neutralisé. Les sources non autorisées sont entièrement exclues et ne fuient pas dans le compteur. Les références polymorphiques invalides sont exclues et tracées côté serveur par raison et nombre, sans identifiant. L'ordre est `recordedAt DESC`, puis identifiant interne décroissant uniquement avant production d'une clé opaque SHA-256 non affichée.

La provenance ne charge jamais le journal complet : une source reliée à un événement expose uniquement une formulation humaine et son horodatage. La dernière validation persistée peut être affichée comme preuve explicite, y compris lorsqu'elle est un rejet; elle ne transforme pas l'état persistant de l'unité. R4 est sans mutation, IA, backfill ou création automatique.

## Capabilities R5-IIIa2

Le read model projette seulement `canEstablish`, `canDispute` et `canValidate`, calculés à partir du type, de l’état, du Workspace actif, du parcours et d’une affectation journey-scoped active dont la matrice contient la permission attendue. Il fournit un jeton de concurrence opaque aux faits et décisions. Aucun rôle, enum de permission, identifiant interne ou motif de refus n’est exposé, et aucune action n’est rendue dans l’interface.

R5-IIIb consomme ces booléens sans recalcul client. Les validations et contestations de portée parcours sont relues même en l’absence de `RelationCase`, afin que l’état confirmé apparaisse immédiatement après `revalidatePath`. Les sources ne reçoivent aucune capability de transition.

### Configuration des jetons de concurrence

Un jeton HMAC est généré uniquement lorsque `canEstablish` ou `canValidate` est vrai. Le serveur résout le secret dans cet ordre : `GOVERNED_MEMORY_TOKEN_SECRET`, `NEXTAUTH_SECRET`, puis `AUTH_SECRET`. L’absence des trois variables est tolérée pour un cockpit sans capability nécessitant un jeton; elle reste une erreur de configuration explicite dès qu’une telle capability est active. Aucun fallback constant ou token non signé n’est autorisé.
