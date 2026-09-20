# Consentement explicite au Parcours

Les nouvelles invitations sont créées en état `PREPARED` avec un consentement `PENDING` et un événement `CREATED`. Ouvrir le lien met uniquement à jour `lastAccessedAt` et ne constitue jamais une acceptation. `acceptedAt` reste réservé au comportement historique de première consultation des invitations sans ligne de consentement.

L'accès d'une nouvelle invitation exige simultanément une invitation `ACTIVE`, non révoquée et non expirée, un consentement `ACCEPTED` et l'identité `User` attendue lors de la décision. Une autorisation de réunion ne remplace ni ce consentement au Parcours ni un futur RSVP.

Les invitations historiques sans consentement sont projetées explicitement comme `LEGACY_UNKNOWN`. Leur comportement d'accès historique reste compatible tant que l'invitation demeure valide ; `acceptedAt` n'est jamais interprété comme une preuve de consentement.

## Identité externe

Le token permet de consulter une présentation limitée de l'invitation. Le runtime actuel ne possède toutefois pas de primitive fiable pour rattacher une personne externe sans `inviteeUserId` à un compte `User`. Cette variante reste donc un `MODEL_GAP` : aucune acceptation ou aucun refus en ligne n'est autorisé et aucune identité artificielle n'est créée. Le flux Annuaire, qui possède un `inviteeUserId` vérifié, est complet.

Il n'existe pas encore de surface naturelle dédiée aux invitations reçues dans la navigation connectée. L'accès reste assuré par le lien d'invitation ; une future notification ou liste compacte pourra référencer les invitations `PENDING` sans constituer un centre de notifications complet.
