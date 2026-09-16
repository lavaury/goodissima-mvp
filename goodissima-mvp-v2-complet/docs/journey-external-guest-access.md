# Assurance d’une invitation externe au Parcours

Une invitation externe personnelle repose sur le niveau `INVITATION_LINK` : le jeton secret prouve seulement la possession du lien et donne accès à cette invitation et à ce Parcours. Il ne vérifie ni le nom déclaré par l’organisateur, ni une identité Goodissima.

Les niveaux d’assurance restent distincts :

- `INVITATION_LINK` : capability personnelle, secrète et strictement limitée à l’invitation ;
- `AUTHENTICATED_ACCOUNT` : compte Goodissima authentifié et explicitement lié à l’invitation ;
- `VERIFIED_ATTRIBUTES` : identité ou attributs vérifiés par une source dédiée, par exemple EUDI.

Une acceptation sans compte conserve donc `decidedByUserId = null` et écrit un événement `INVITEE` avec `actorUserId = null`. Les accès qui exigent une identité authentifiée, notamment les contrôles actuels des réunions et médias, ne sont pas ouverts par cette seule acceptation.

## Affectation de l’organisateur à un rôle attendu

La page de pilotage est actuellement réservée au propriétaire du Journey, déjà participant en qualité d’organisateur. Le modèle ne possède pas encore d’association explicite entre ce participant existant et un `expectedRoleId`. L’action « M’affecter à ce rôle » reste donc un `MODEL_GAP` à traiter par une future association de rôle dédiée. Une invitation explicite de son propre profil Annuaire reste possible et conserve un consentement `PENDING` ; elle ne vaut ni affectation directe ni auto-acceptation.
