# RSVP réunion — règle V1

Le RSVP est distinct du consentement au Parcours, de l’autorisation technique et de la présence observée.

- Une nouvelle participation issue du flux de consentement crée atomiquement une autorisation technique, un RSVP `PENDING` et un événement `INVITED`.
- L’accès média exige un Parcours accepté, un participant autorisé et un RSVP `ACCEPTED` portant la révision courante de la réunion.
- Une réunion annoncée « Date à définir » peut recevoir une réponse. La première fixation de sa date ne réinitialise pas cette réponse.
- Le déplacement d’une date déjà fixée est substantiel : il incrémente la révision et remet tous les RSVP du nouveau flux en attente dans la même transaction.
- L’objectif n’est pas éditable dans l’UX actuelle. Lorsqu’il le deviendra, son changement significatif devra emprunter explicitement le même mécanisme de révision ; `updatedAt` ne doit jamais servir de déclencheur.
- Les changements de fournisseur, jeton ou média ne réinitialisent pas les RSVP.
- Les lignes historiques sans RSVP restent projetées `LEGACY_UNKNOWN` et ne sont jamais présentées comme acceptées.
