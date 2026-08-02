# Modèle conceptuel de mémoire gouvernée — MG-1

## Promesse et périmètre

La mémoire gouvernée restitue ce qui était connu, applicable, décidé, accessible et contesté dans **un seul `RelationCase`**, sans transformer une déduction en vérité officielle. Le seul scope MG-1 est `RELATION_CASE`. Il n’existe ni corrélation, ni lien, ni recherche cross-case.

MG-1 est un modèle conceptuel pur : pas de persistance, migration, repository, API, interface, moteur IA ou stockage vectoriel. Les contrats ne préjugent ni du stockage futur ni du fournisseur de synthèse.

## Audit des objets existants

`RelationCase` est l’unique frontière d’ownership et de cycle de vie. `Document` et ses futures versions, `FormSubmission`, des extraits explicitement promus de `Message`, et certains `RelationEvent`/`AuditLog` peuvent devenir des **sources référencées**. `GoodissimaIdentity`, `GovernedJourneyInvitation`, `AccessInvitation` et `CommunicationSession` peuvent seulement documenter une identité, une autorisation ou un événement lorsque la gouvernance le décide explicitement.

`RelationEvent`, `RelationAction`, `AuditLog`, `Message`, `Document` et `FormSubmission` ne doivent pas être réutilisés comme faits, décisions ou mémoire : leurs champs libres, leur finalité opérationnelle et leurs cycles de vie ne portent pas les invariants requis. Une invitation ne prouve pas une consultation ; une session ne prouve ni accord ni causalité ; une action ne vaut pas décision validée ; un événement n’est pas automatiquement un fait établi.

Conventions réutilisables : identifiants opaques, rattachement explicite au dossier, horodatages distincts, historique append-only, concurrence explicite dans les futurs services et séparation entre statut et audit. Ambiguïtés à éviter : `createdAt` ne remplace pas `effectiveFrom`, un acteur technique n’est pas un validateur humain, et ownership, visibilité, permission et accès observé sont quatre notions distinctes.

## Vocabulaire canonique

- `GovernedMemoryScope` : frontière `RelationCase` unique.
- `GovernedMemoryFact` : énoncé proposé, établi, contesté ou remplacé.
- `GovernedMemoryDecision` : décision humaine, immuable après validation.
- `GovernedMemorySource` : trace ou déclaration servant d’appui, jamais conclusion automatique.
- `GovernedMemoryEvent` : changement observé append-only, sans causalité implicite.
- `GovernedMemoryAccessGrant` : droit explicite et temporel.
- `GovernedMemorySynthesis` : réponse temporaire ou instantané humainement validé.
- `GovernedMemoryValidation` : appréciation humaine append-only.
- `GovernedMemoryDispute` : contestation historique non destructive.
- `GovernedMemoryRelation` : lien typé entre catégories autorisées.

Les identifiants sont des branded types sans générateur MG-1.

## Temporalité bitemporelle

`recordedAt` indique quand Goodissima a connu l’élément ; `effectiveFrom`/`effectiveUntil` indiquent quand il s’applique ; `supersededAt` clôt sa version sans la réécrire. Une date d’effet peut précéder l’enregistrement. Une restitution à T ne sélectionne que les éléments enregistrés au plus tard à T, même si une information enregistrée plus tard se révèle rétroactivement vraie.

Les sources distinguent `authoredAt`, `receivedAt` et `recordedAt`. Les décisions distinguent `decidedAt`, `effectiveFrom` et `recordedAt`. Les fonctions pures `wasKnownAt`, `wasEffectiveAt`, `wasAccessibleAt`, `isTemporallyValid` et `selectStateAt` utilisent une horloge injectée ; aucune dépendance implicite à `new Date()`.

## Faits et niveau de preuve

Statuts : `PROPOSED`, `ESTABLISHED`, `DISPUTED`, `SUPERSEDED`. Le niveau de preuve séparé est `DECLARED`, `SUPPORTED`, `CORROBORATED` ou `CONTESTED`; aucun score numérique opaque.

Un fait établi exige un responsable de mémoire ou délégataire, une validation et une date. Sans source, `ESTABLISHED_WITHOUT_DOCUMENTARY_EVIDENCE` rend la limite explicite. Une contestation conserve la version antérieure. Un remplacement exige un successeur, interdit l’auto-référence et les cycles.

## Décisions immuables

Statuts : `DRAFT`, `VALIDATED`, `SUPERSEDED`, `CANCELLED`. Une décision validée exige un motif humain explicite. Elle ne change plus : correction, remplacement, annulation ou complément produisent une nouvelle décision reliée par `CORRECTS`, `REPLACES`, `CANCELS` ou `COMPLEMENTS`. Les conséquences décrivent des effets attendus, pas des effets observés. L’absence de source documentaire est permise mais signalée.

## Sources et rétention

Kinds : document, version, formulaire, extrait de message, événement système, déclaration humaine, synthèse validée ou import externe. Statuts : actif, archivé, restreint, expiré, anonymisé, supprimé ou legal hold.

Une source n’est pas nécessairement vraie. `DELETED` et `ANONYMIZED` conservent une référence historique minimale et une raison, sans présenter le contenu comme consultable. `EXTERNAL_IMPORT` indique son origine non gouvernée. Une synthèse validée n’est qu’une source secondaire et garde des références vers les sources primaires.

## Messages privés

Seul un extrait borné est promu, par action humaine, avec finalité, visibilité et l’une des bases fermées : auteur promouvant son message, consentement explicite documenté, autorité de gouvernance documentée ou obligation légale documentée. Le message original reste inchangé. La visibilité ne s’élargit jamais et aucun message entier n’est promu par défaut. L’IA ne promeut rien.

## Événements

Un événement distingue `occurredAt` et `recordedAt`, son acteur `HUMAN` ou `SYSTEM`, ses objets et sa visibilité. Il est append-only. Le système peut enregistrer un événement système, jamais transformer seul cet événement en fait, causalité ou décision.

## Droits, visibilité et révocation

Les permissions couvrent consultation, proposition/établissement/contestation, décision, validation, gestion d’accès et promotion privée. Chaque grant porte sujet, ressource, base, début, fin et révocation. Une révocation ferme le futur par défaut ; les contributions restent attribuées. Un accès résiduel doit être explicite, limité et daté.

La visibilité est `CASE_PARTICIPANTS`, `MEMORY_STEWARDS`, `SPECIFIC_SUBJECTS`, `PRIVATE_TO_AUTHOR` ou `RESTRICTED`. Les deux dernières formes structurées exigent sujets ou policy. La disponibilité historique ne suffit jamais : les droits actuels filtrent toute restitution. Le rôle de responsable ne contourne pas une source plus restreinte. Une synthèse respecte l’intersection des droits de toutes ses sources.

### Matrice conceptuelle

| Rôle | Proposer | Établir | Contester | Décision | Valider synthèse | Promouvoir message | Gérer accès | Voir sources/historique |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Propriétaire du dossier | Oui | Non par défaut | Oui | Oui | Non par défaut | Non par défaut | Non par défaut | Selon grants |
| Responsable mémoire | Oui | Oui | Oui | Oui | Oui | Oui | Oui | Selon visibilité |
| Délégataire explicite | Oui | Oui | Oui | Oui | Oui | Oui | Selon délégation | Selon visibilité |
| Contributeur | Oui | Non | Oui | Non | Non | Son message avec base | Non | Selon grants |
| Lecteur | Non | Non | Non | Non | Non | Non | Non | Selon grants |
| Participant révoqué | Non | Non | Non | Non | Non | Non | Non | Aucun par défaut |
| Système | Non | Non | Non | Non | Non | Non | Non | Traitement autorisé seulement |
| IA assistante | Suggestion | Jamais | Suggestion | Jamais | Jamais | Jamais | Jamais | Contexte déjà filtré |

## Synthèses

Statuts : `GENERATED_UNVERIFIED`, `VALIDATED`, `PARTIALLY_VALIDATED`, `DISPUTED`, `SUPERSEDED`. Une génération est temporaire, n’est pas une preuve et ne peut servir de source. Une synthèse validée devient un instantané immuable ; une nouvelle version remplace l’ancienne sans mutation.

Les faits établis, inférences et limitations sont des structures séparées. Toute inférence liste ses supports, prudence, auteur et avertissement non factuel. Les limitations sont toujours présentes, même vides, et couvrent notamment source manquante, accès non prouvé, contradiction, couverture temporelle, suppression ou causalité non démontrée. Une dépendance contestée est signalée. Les cycles de synthèses sont interdits.

## Validations et contestations

Une validation cible un fait, une décision, une synthèse ou une promotion. Elle est humaine, motivée en cas de rejet/réserve et append-only. Le statut courant se déduit chronologiquement de la dernière validation applicable sans effacer les précédentes.

Une contestation peut viser fait, décision, synthèse ou source. Elle ne supprime jamais sa cible. Une contestation ouverte reste visible ; résolution et maintien sont humains ; retrait reste attribué à son auteur. Une validation ultérieure n’efface pas la trace de contestation.

## Relations typées

Les relations autorisent seulement des couples documentés : fait/décision vers source, décision vers fait, succession homogène, contestation/validation vers leurs cibles, et synthèse vers fait/décision/source/synthèse. Chaque extrémité porte son scope. Les liens cross-case, combinaisons libres, auto-références et cycles de succession sont refusés.

## Contrats de requête et réponse

MG-1 définit `GetMemoryStateAtInput`, `CompareMemoryPeriodsInput`, `ExplainDecisionInput`, `ReconstructAccessInput`, `ValidateSynthesisInput`, `ProposeFactInput`, `EstablishFactInput` et `DisputeMemoryObjectInput`, sans moteur.

`GovernedMemoryAnswer` sépare résumé, faits établis, décisions, chronologie, inférences, limites, sources, statut de validation et redactions. Un objet interdit est omis ou remplacé par une redaction non sensible. Aucun contrat ne prétend qu’un fournisseur IA produit la vérité officielle.

## Invariants

1. Un objet appartient à exactement un `RelationCase`; aucun lien cross-case.
2. Décisions validées et synthèses validées sont immuables.
3. Seul un humain autorisé établit ou valide.
4. Une synthèse non validée n’est jamais une source.
5. Toute source secondaire remonte à une source primaire.
6. Aucun cycle de remplacement ou de synthèse.
7. Aucun message privé sans base et visibilité explicites.
8. Une source supprimée n’est jamais présentée disponible.
9. Révocation et droits actuels prévalent sur l’accès historique.
10. Inférences, faits et limitations restent distincts.
11. Contestations et validations restent append-only.
12. Aucune action IA ne produit un état officiel.

## Exemples complets

### « Où en étions-nous à une date donnée ? »

- Faits : uniquement établis, enregistrés au plus tard à T et effectifs à T.
- Sources : documents et déclarations accessibles à T et encore autorisés aujourd’hui.
- Inférence : « la trajectoire semblait incertaine », explicitement non factuelle.
- Limites : document reçu après T, donc exclu de la connaissance historique.
- Droits : retrait des éléments dont le demandeur n’a plus le droit courant.

### « Quelle décision a changé la trajectoire ? »

- Faits : états avant/après sans prétendre à une causalité.
- Sources : motif humain et pièces citées par la décision.
- Inférence : contribution probable de la décision, avec causalité non démontrée.
- Limites : autres facteurs non documentés.
- Droits : redaction d’une source restreinte sans révéler son contenu.

### « Quel document a modifié l’analyse ? »

- Faits : changement d’analyse enregistré, distinct du document.
- Sources : version précise, date d’auteur, réception et enregistrement.
- Inférence : lien d’influence seulement si non décidé explicitement.
- Limites : document supprimé ou version antérieure indisponible.
- Droits : citation d’existence possible, contenu seulement si autorisé.

### « Qui avait accès à quoi à cette date ? »

- Faits : grants effectifs et révocations enregistrées à T.
- Sources : invitations ou logs comme traces, jamais preuve de consultation.
- Inférence : aucune consultation déduite d’un simple droit.
- Limites : accès effectif non prouvé.
- Droits : la personne qui interroge doit aujourd’hui pouvoir consulter l’historique demandé.

## Limites et hors périmètre

Le modèle ne choisit ni stockage, stratégie de concurrence, RLS, moteur de recherche, génération, empreinte de corpus ni politique juridique de rétention. Les règles de visibilité entre sources devront être traduites en policy vérifiable avant persistance. La délégation et le rôle de responsable devront disposer d’une autorité explicite future, sans dérivation implicite depuis l’ownership.

## Impact Boussole

MG-1 n’ajoute aucune page, cible, étape ou donnée produit. Aucun état `EMPTY`, `POPULATED` ou `FOCUSED` n’est modifié. `journeyVersion` reste inchangée.
