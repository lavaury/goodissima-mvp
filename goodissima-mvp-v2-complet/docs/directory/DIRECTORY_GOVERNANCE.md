# Annuaire Goodissima — gouvernance des représentations

## Lot 1

Une `GoodissimaIdentity` est la racine stable d'une personne ou d'une organisation. Une `Representation` est une manière contextuelle et administrée par un `User` de se présenter. Une identité peut donc porter plusieurs représentations.

Une représentation est privée et non découvrable par défaut. Le statut `ACTIVE` signifie uniquement qu'elle est utilisable par son propriétaire : il ne crée aucune visibilité globale. `HIDDEN` masque temporairement la représentation dans l'espace personnel futur. `ARCHIVED` la conserve sans suppression ; l'archivage est réversible par une restauration humaine explicite.

Le propriétaire doit être lié à l'identité porteuse. Cette règle est vérifiée par le service, le repository et une clé étrangère composite en base. Toutes les lectures et mutations applicatives incluent `ownerId`. La table active RLS sans policy navigateur, conformément aux tables serveur du dépôt.

Les tables historiques `goodissima_profiles`, `goodissima_requests`, `goodissima_relations`, `goodissima_channels`, `goodissima_entry_doors`, `goodissima_discovery_contexts` et `goodissima_history_events` restent hors runtime. Elles ne sont ni renommées, ni reconnectées, ni réutilisées.

Ce lot ne crée aucune capacité, visibilité publique, préférence de canal, demande, contact, invitation, conversation, session média, notification ou opération de matching. Les futures intégrations EUDI Wallet et IA resteront découplées de ce socle.

## Lot 2B — politique relationnelle

Le statut technique (`ACTIVE`, `HIDDEN`, `ARCHIVED`), la future visibilité (`PRIVATE`, `DISCOVERABLE`) et la politique relationnelle sont trois dimensions indépendantes. Masquer, archiver ou restaurer une représentation ne modifie jamais sa politique.

La politique relationnelle est choisie explicitement par le propriétaire :

- `OPEN` (« Ouvert ») autorisera plus tard les nouvelles demandes selon les canaux activés ;
- `MESSAGE_ONLY` (« Messagerie uniquement ») interdira voix et visio et n’autorisera que les demandes de message ;
- `CLOSED` (« Fermé ») interdira toute nouvelle demande relationnelle.

Dans ce lot, cette politique est uniquement persistée et affichée. Elle ne crée ni demande, ni contact, ni message, ni canal, ni notification et n’a aucun effet rétroactif. `CLOSED` ne supprime pas les contacts existants, ne révoque aucun accès à un dossier ou parcours et ne ferme pas les conversations existantes. Les futurs canaux consulteront cette politique, avec leurs préférences détaillées, lorsqu’un moteur de demandes sera introduit.

## Lot 3A — découvrabilité explicite

Le statut technique, la visibilité et la politique relationnelle sont indépendants : `status ≠ visibility ≠ relationshipPolicy`. Une représentation est toujours créée avec la visibilité `PRIVATE`, même lorsqu’elle est `ACTIVE`. Seule une action humaine explicite peut la passer à `DISCOVERABLE`, et uniquement lorsqu’elle est active.

La projection publique autorise seulement l’identifiant opaque propre à la représentation, le nom d’affichage, le type, le titre, l’organisation, la description, le territoire, la politique relationnelle et la date de publication. Elle exclut `ownerId`, `identityId`, les coordonnées, les claims, les notes privées et les dates internes. L’identifiant existant est un `cuid` opaque propre à chaque représentation ; aucun identifiant public supplémentaire n’est nécessaire à ce stade et aucune corrélation d’identité n’est exposée.

Masquer ou archiver une représentation la repasse à `PRIVATE` et efface `publishedAt` dans la même mutation que le changement de statut. Restaurer une représentation la rend active mais jamais découvrable. La politique relationnelle reste inchangée lors de toutes ces transitions.

La publication ne crée aucune demande, aucun contact, aucun message, aucun canal, aucune invitation, aucune notification et aucune opération de matching.

## Lot 3B — lecture globale

L’onglet Global lit réellement la projection publique côté serveur, sans requête par carte ni chargement initial client. Une représentation apparaît uniquement si elle est simultanément `ACTIVE`, `DISCOVERABLE` et assortie d’un `publishedAt` non nul. Une dépublication, un masquage ou un archivage la retire donc de la lecture suivante ; la page désactive explicitement le cache persistant.

La recherche déterministe, insensible à la casse, porte sur le nom d’affichage, le titre, l’organisation, la description et le territoire. Les filtres exacts portent sur le type et la politique relationnelle ; le territoire utilise une recherche textuelle insensible à la casse. L’ordre reste `publishedAt DESC`, puis `id ASC`.

La V1 affiche au maximum 50 résultats et invite à affiner la recherche lorsque davantage de résultats existent. Chaque représentation reste un objet autonome : aucun regroupement par identité, aucune autre représentation du même propriétaire et aucune coordonnée ne sont exposés. Les cartes sont informatives et ne permettent encore aucune prise de contact.

## Lot 4 — demandes de contact explicites

Une demande relie une représentation source appartenant au demandeur à une représentation cible publiée. La création exige une source `ACTIVE` et une cible `ACTIVE`, `DISCOVERABLE`, avec `publishedAt` renseigné. Une cible dépubliée, masquée ou archivée après création ne provoque aucune décision automatique : la demande demeure un historique visible uniquement par ses deux parties.

La politique de la cible est évaluée uniquement à la création. `OPEN` autorise `MESSAGE`, `VOICE` et `VIDEO`; `MESSAGE_ONLY` autorise exclusivement une demande ne contenant que `MESSAGE`; `CLOSED` interdit toute nouvelle demande. Une évolution ultérieure de cette politique ne réécrit pas les demandes existantes.

Les statuts sont `PENDING`, `ACCEPTED`, `REFUSED`, `DEFERRED`, `CANCELLED` et `EXPIRED`. L’échéance vaut 30 jours par défaut et doit rester entre 1 et 90 jours. Sans cron, l’expiration est matérialisée de façon transactionnelle lors d’une lecture ou mutation pertinente. Un report, réservé au propriétaire cible, exige une date comprise entre 1 et 30 jours. Il reste `DEFERRED` jusqu’à une reprise humaine explicite vers `PENDING`; il n’autorise aucun canal.

Chaque mutation exige une action humaine et une version `updatedAt` attendue. Le demandeur peut annuler une demande `PENDING` ou `DEFERRED`; le propriétaire cible peut accepter, refuser, reporter ou reprendre selon le statut. Une ressource hors scope retourne 404. Les événements de cycle de vie sont conservés dans un journal append-only dédié : le repository n’expose aucune mise à jour ou suppression d’événement, et aucune suppression de demande. `VIEWED_BY_TARGET` est ajouté uniquement à la première lecture cible connue; un index unique partiel et `skipDuplicates` couvrent aussi les lectures concurrentes. Les décisions et la matérialisation transactionnelle d’`EXPIRED` n’ajoutent un événement que lorsque la transition conditionnelle a réellement modifié la demande.

Les canaux d’une demande sont dédupliqués par le contrat puis comparés sous forme d’un ensemble canonique trié pour détecter un doublon `PENDING`, indépendamment de l’ordre reçu. Cette prévention reste applicative : sans empreinte canonique ni contrainte SQL couvrant l’ensemble de canaux, deux créations strictement concurrentes pourraient encore produire deux demandes identiques. Ce risque résiduel est accepté pour ce lot afin de ne pas introduire de hash ou de modèle plus complexe.

`ACCEPTED` signifie uniquement qu’un accord humain a été persisté. Ce statut ne crée ni `RepresentationContact`, ni message, ni `CommunicationSession`, ni invitation, notification, accès ou résultat de matching. Les contacts contextualisés seront introduits au Lot 5.
