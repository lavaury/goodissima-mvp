# PARCOURS-UX-03A — audit des primitives

Audit réalisé le 2026-09-15 sur la baseline `2f0610353525e58afb4fb00ef368490536e1af56`.

## Persisté

- Les participants prévus et leurs rôles métier sont conservés dans le plan de création du snapshot de `TemplateVersion`.
- Les invitations préparées, non envoyées automatiquement, sont conservées dans ce même snapshot.
- `GovernedJourneyInvitation` conserve l'accès actif, révoqué ou expiré, le rôle d'accès, l'expiration et les dates de première/dernière consultation.
- `CommunicationSession` conserve titre, objectif, date et état de réunion.
- `GovernedMeetingParticipant` conserve seulement l'autorisation ou le retrait d'accès à une réunion.
- Les rôles et droits de mémoire sont persistés et projetés en capabilities par le service serveur GovernedMemory.

## Calculé

- Le rapprochement entre participant prévu, invitation préparée et accès actif est calculé par nom et rôle.
- Les compteurs du cadre et les actions « À faire maintenant » sont dérivés de ces objets réels.
- Le rôle « Organisateur » du cockpit découle de la garde serveur de lecture propriétaire du parcours.

## UI uniquement

- Le brouillon de message est préparé pour une transmission manuelle ; Goodissima ne l'envoie pas.
- Les libellés humains décrivent les états persistés sans transformer « autorisé » en « a accepté ».

## Manques conservés

- `JOURNEY-CONSENT-01` : aucun cycle persistant INVITED/ACCEPTED/DECLINED. `acceptedAt` signifie aujourd'hui première ouverture du lien, pas consentement explicite.
- `MEETING-RSVP-01` : aucun RSVP persistant. AUTHORIZED/REMOVED décrit un accès, pas une réponse de présence.
- `PARCOURS-UX-03B` : surface de réunion multipersonne dédiée et responsive à traiter séparément.

Aucun schéma ni migration n'est introduit dans 03A.
