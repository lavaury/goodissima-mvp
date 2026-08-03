# Agrégat persistant de parcours gouverné — GJ-0

## Pourquoi un nouvel agrégat

`RelationTemplate`, `FormTemplate` et `TemplateVersion` décrivent une définition réutilisable. Jusqu'à GJ-0, le cockpit appelait « parcours » un `FormTemplate` et lisait son plan dans `TemplateVersion.snapshot.metadata.creationPlan`. Un `RelationTemplate` pouvant alimenter plusieurs `RelationCase`, aucun de ces objets ne représente une instance appartenant à un dossier précis.

`GovernedJourney` matérialise cette instance. Sa hiérarchie est :

```text
RelationTemplate / FormTemplate / TemplateVersion (définition réutilisable)
                         ↓ instanciation explicite
RelationCase 1 ─── n GovernedJourney (instance gouvernée)
```

Un template partagé ne confère aucun accès aux dossiers qui l'utilisent.

## Cardinalités, propriétaire et autorité

- un parcours appartient à exactement un `RelationCase` ;
- un dossier peut porter plusieurs parcours ;
- un template et une version peuvent être utilisés par plusieurs parcours ;
- `ownerId` désigne le propriétaire institutionnel ou technique du dossier ;
- `authorityUserId` désigne conceptuellement l'autorité humaine gouvernant le parcours ;
- dans le socle provisoire GJ-0, cette autorité est obligatoirement le propriétaire réel du dossier ;
- la FK composite `(relationCaseId, authorityUserId) → RelationCase(id, ownerId)` empêche une autorité arbitraire ;
- toutes les relations structurantes utilisent `ON DELETE RESTRICT`.

Le service ne déduit jamais l'autorité de `metadata.createdById`, d'une invitation ou du propriétaire d'un template. La restriction au propriétaire est volontairement provisoire : GJ-0 ne sait pas encore représenter un magistrat délégué, un responsable métier ou une autre autorité non propriétaire. Un futur mécanisme d'affectation append-only devra rendre explicites la nomination, la révocation et leur auteur avant d'assouplir la FK actuelle. Un simple accès au dossier ne devra jamais suffire.

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

La création produit atomiquement un `GovernedJourneyEvent` de type `CREATED`. Cette table est append-only au niveau applicatif : aucun service d'update ou de delete n'est exposé. RLS est activée sans policy navigateur permissive. L'immutabilité complète par trigger SQL reste hors périmètre de GJ-0.

## Création transactionnelle

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
