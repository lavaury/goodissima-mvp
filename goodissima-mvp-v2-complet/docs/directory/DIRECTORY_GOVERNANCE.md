# Annuaire Goodissima — gouvernance des représentations

## Lot 1

Une `GoodissimaIdentity` est la racine stable d'une personne ou d'une organisation. Une `Representation` est une manière contextuelle et administrée par un `User` de se présenter. Une identité peut donc porter plusieurs représentations.

Une représentation est privée et non découvrable par défaut. Le statut `ACTIVE` signifie uniquement qu'elle est utilisable par son propriétaire : il ne crée aucune visibilité globale. `HIDDEN` masque temporairement la représentation dans l'espace personnel futur. `ARCHIVED` la conserve sans suppression ; l'archivage est réversible par une restauration humaine explicite.

Le propriétaire doit être lié à l'identité porteuse. Cette règle est vérifiée par le service, le repository et une clé étrangère composite en base. Toutes les lectures et mutations applicatives incluent `ownerId`. La table active RLS sans policy navigateur, conformément aux tables serveur du dépôt.

Les tables historiques `goodissima_profiles`, `goodissima_requests`, `goodissima_relations`, `goodissima_channels`, `goodissima_entry_doors`, `goodissima_discovery_contexts` et `goodissima_history_events` restent hors runtime. Elles ne sont ni renommées, ni reconnectées, ni réutilisées.

Ce lot ne crée aucune capacité, visibilité publique, préférence de canal, demande, contact, invitation, conversation, session média, notification ou opération de matching. Les futures intégrations EUDI Wallet et IA resteront découplées de ce socle.
