# Fondation persistante du RSVP réunion

Le consentement au Journey, le RSVP à une réunion, l'autorisation technique et la présence observée sont quatre concepts distincts. Un `GovernedMeetingParticipant` historique `AUTHORIZED` ne prouve jamais un RSVP `ACCEPTED`. L'absence de `GovernedMeetingRsvp` se projette comme `LEGACY_UNKNOWN`, sans ajouter cette valeur à l'enum persistée.

`CommunicationSession.rsvpRevision` versionne uniquement les caractéristiques substantielles présentées au participant. Dans une tranche ultérieure, un changement explicite de date/heure ou d'objectif significatif incrémentera cette révision, remettra les RSVP concernés à `PENDING` et écrira `RESET_TO_PENDING`. Une correction typographique ne devra pas produire ce reset et `updatedAt` ne devra jamais servir de révision RSVP.

Cette fondation n'ajoute aucune action Participer/Décliner, ne change aucun contrôle média, ne crée aucune notification et ne transforme aucune trace de présence en consentement.
