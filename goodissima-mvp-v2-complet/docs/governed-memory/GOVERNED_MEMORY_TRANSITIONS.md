# Transitions futures de mémoire gouvernée

R5-IIIa1 livre uniquement les fondations structurelles. Les validations et contestations peuvent désormais qualifier une mémoire rattachée à un `RelationCase`, à un `GovernedJourney`, ou aux deux sous une même racine `RelationTemplate`. Les lignes historiques conservent leur dossier et ne reçoivent aucun parcours artificiel.

Les rôles mémoire journey-scoped sont des affectations explicites, révocables et limitées à `MEMORY_STEWARD` et `MEMORY_DELEGATE`. Aucun rôle n'est attribué par migration. `GovernedJourney.authorityUserId`, le propriétaire du Workspace et un rôle case-scoped ne valent pas affectation globale.

Les permissions restent dérivées de la matrice canonique : le rôle et la permission sont deux vérifications distinctes dans le futur R5-IIIa2. L'autorité d'attribution humaine n'est pas encore livrée. Aucune commande de transition, UI, validation, contestation ou automatisation n'est ajoutée en R5-IIIa1.

## R5-IIIa2 — commandes serveur

Le propriétaire d’un Workspace `ACTIVE` peut désormais attribuer et révoquer explicitement `MEMORY_STEWARD` ou `MEMORY_DELEGATE`. Cette administration ne lui confère aucun rôle implicite. Les titulaires doivent disposer d’une affectation journey-scoped active et de la permission statique correspondante pour établir un fait, contester un fait ou valider une décision.

Les cinq commandes réservent une `GovernedMemoryTransitionRequest` dans une transaction `Serializable`. Le lookup d’idempotence utilise uniquement l’utilisateur et la clé UUID v4; un fingerprint SHA-256 protège le payload. Les collisions `P2002` et `P2034` sont traitées avec deux tentatives maximum. Les faits et décisions utilisent en plus un jeton de concurrence opaque.

L’établissement produit une validation `APPROVED`, passe conditionnellement le fait de `PROPOSED` à `ESTABLISHED` et ajoute `FACT_ESTABLISHED`. La contestation crée une ligne `OPEN` et `DISPUTE_OPENED` sans changer le statut du fait. La validation d’une décision accepte seulement `APPROVED`, passe `DRAFT` à `VALIDATED` et ajoute `DECISION_VALIDATED`.

Les capabilities booléennes sont préparées dans le read model R4, sans bouton ni Server Action. L’archivage des sources, les validations partielles, le rejet, les notifications, l’IA et les routes GJ restent exclus.

## R5-IIIb — cockpit humain

Les cartes réelles affichent désormais `Établir ce fait`, `Contester ce fait` ou `Valider la décision` uniquement lorsque la capability serveur correspondante est vraie. Chaque confirmation conserve une UUID v4 initialisée côté serveur; l’établissement et la validation transmettent aussi le jeton HMAC opaque. Les Server Actions authentifient, délèguent aux commandes R5-IIIa2 et revalident le cockpit sans état optimiste fictif.

Le propriétaire voit les fonctions mémoire actives et peut les révoquer avec confirmation. L’attribution visible reste arrêtée : aucun sélecteur d’utilisateur applicatif owner-scoped sûr n’existe, et les contacts de l’Annuaire ne constituent pas une identité utilisateur. Aucun champ d’ID libre, invitation ou recherche globale n’a été introduit.

## R5-IIIc — règle transitoire de prise de fonction

Dans l’attente d’une désignation collective, l’organisateur — le propriétaire du Workspace `ACTIVE` — peut prendre explicitement la fonction de Responsable de la mémoire pour lui-même. La Server Action fixe côté serveur la cible à l’utilisateur authentifié et le rôle canonique à `MEMORY_STEWARD`; aucune cible ni enum ne vient du client. Cette possibilité n’est ni automatique ni une propriété supplémentaire du parcours.

L’organisateur responsable peut renoncer explicitement à la fonction. La ligne d’affectation est révoquée par `revokedAt`, les qualifications historiques restent conservées et les capabilities sont recalculées après revalidation. Le futur contrat collectif devra traiter vote, acceptation, remplacement et journalisation métier complète.
