# Transitions futures de mémoire gouvernée

R5-IIIa1 livre uniquement les fondations structurelles. Les validations et contestations peuvent désormais qualifier une mémoire rattachée à un `RelationCase`, à un `GovernedJourney`, ou aux deux sous une même racine `RelationTemplate`. Les lignes historiques conservent leur dossier et ne reçoivent aucun parcours artificiel.

Les rôles mémoire journey-scoped sont des affectations explicites, révocables et limitées à `MEMORY_STEWARD` et `MEMORY_DELEGATE`. Aucun rôle n'est attribué par migration. `GovernedJourney.authorityUserId`, le propriétaire du Workspace et un rôle case-scoped ne valent pas affectation globale.

Les permissions restent dérivées de la matrice canonique : le rôle et la permission sont deux vérifications distinctes dans le futur R5-IIIa2. L'autorité d'attribution humaine n'est pas encore livrée. Aucune commande de transition, UI, validation, contestation ou automatisation n'est ajoutée en R5-IIIa1.

R5-IIIa2 devra encore décider précisément l'autorisation de contestation globale et livrer l'idempotence des transitions. L'archivage des sources et les validations `PARTIALLY_APPROVED`, `REJECTED` et `WITH_RESERVATIONS` restent exclus.
