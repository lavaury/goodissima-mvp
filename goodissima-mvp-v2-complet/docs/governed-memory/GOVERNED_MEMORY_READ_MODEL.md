# Lecture et reconstruction de la mémoire gouvernée — MG-3

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

## Cohérence de lecture

Chaque opération de lecture utilise une transaction Prisma unique au niveau d'isolation PostgreSQL `RepeatableRead`. L'existence et le scope du `RelationCase`, les représentations du requester, ses rôles actifs, ses grants globaux ou ciblés, les révocations, les expirations et les objets gouvernés sont lus avec le même client transactionnel. Les occultations et le résultat sont construits avant la fermeture de cette transaction.

Une seule horloge est capturée au début de l'opération. Elle détermine l'activité des rôles et grants, les expirations, les droits résiduels et `generatedAt`.

Une révocation commise avant le début du snapshot est visible et retire le droit correspondant. Une révocation concurrente commise après le début du snapshot peut ne pas modifier la requête déjà ouverte : c'est la sémantique normale de l'instantané `RepeatableRead`, et non une fenêtre entre contrôle et lecture. Cette autorisation de snapshot ne vaut jamais autorisation durable pour une requête ultérieure.

`compareMemoryPeriods` résout les droits actuels une seule fois et reconstruit les deux états dans la même transaction `RepeatableRead`. La comparaison est ainsi atomique par rapport au même snapshot d'autorisations et de données.

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
