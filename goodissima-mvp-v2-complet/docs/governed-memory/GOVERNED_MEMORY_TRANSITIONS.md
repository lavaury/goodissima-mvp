# Transitions futures de mémoire gouvernée

R5-IIIa1 livre uniquement les fondations structurelles. Les validations et contestations peuvent désormais qualifier une mémoire rattachée à un `RelationCase`, à un `GovernedJourney`, ou aux deux sous une même racine `RelationTemplate`. Les lignes historiques conservent leur dossier et ne reçoivent aucun parcours artificiel.

Les rôles mémoire journey-scoped sont des affectations explicites, révocables et limitées à `MEMORY_STEWARD` et `MEMORY_DELEGATE`. Aucun rôle n'est attribué par migration. `GovernedJourney.authorityUserId`, le propriétaire du Workspace et un rôle case-scoped ne valent pas affectation globale.

Les permissions restent dérivées de la matrice canonique : le rôle et la permission sont deux vérifications distinctes dans le futur R5-IIIa2. L'autorité d'attribution humaine n'est pas encore livrée. Aucune commande de transition, UI, validation, contestation ou automatisation n'est ajoutée en R5-IIIa1.

## R5-IIIa2 — commandes serveur

Le propriétaire d’un Workspace `ACTIVE` peut désormais attribuer et révoquer explicitement `MEMORY_STEWARD` ou `MEMORY_DELEGATE`. Cette administration ne lui confère aucun rôle implicite. Les titulaires doivent disposer d’une affectation journey-scoped active et de la permission statique correspondante pour établir un fait, contester un fait ou valider une décision.

Les cinq commandes réservent une `GovernedMemoryTransitionRequest` dans une transaction `Serializable`. Le lookup d’idempotence utilise uniquement l’utilisateur et la clé UUID v4; un fingerprint SHA-256 protège le payload. Les collisions `P2002` et `P2034` sont traitées avec deux tentatives maximum. Les faits et décisions utilisent en plus un jeton de concurrence opaque.

L’établissement produit une validation `APPROVED`, passe conditionnellement le fait de `PROPOSED` à `ESTABLISHED` et ajoute `FACT_ESTABLISHED`. La contestation crée une ligne `OPEN` et `DISPUTE_OPENED` sans changer le statut du fait. La validation d’une décision accepte seulement `APPROVED`, passe `DRAFT` à `VALIDATED` et ajoute `DECISION_VALIDATED`.

Les capabilities booléennes sont préparées dans le read model R4, sans bouton ni Server Action. L’archivage des sources, les validations partielles, le rejet, les notifications, l’IA et les routes GJ restent exclus.
