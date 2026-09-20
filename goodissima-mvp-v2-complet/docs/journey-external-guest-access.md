# Assurance d’une invitation externe au Parcours

Une invitation externe personnelle repose sur le niveau `INVITATION_LINK` : le jeton secret prouve seulement la possession du lien et donne accès à cette invitation et à ce Parcours. Il ne vérifie ni le nom déclaré par l’organisateur, ni une identité Goodissima.

Les niveaux d’assurance restent distincts :

- `INVITATION_LINK` : capability personnelle, secrète et strictement limitée à l’invitation ;
- `AUTHENTICATED_ACCOUNT` : compte Goodissima authentifié et explicitement lié à l’invitation ;
- `VERIFIED_ATTRIBUTES` : identité ou attributs vérifiés par une source dédiée, par exemple EUDI.

Une acceptation sans compte conserve donc `decidedByUserId = null` et écrit un événement `INVITEE` avec `actorUserId = null`. Les accès qui exigent une identité authentifiée, notamment les contrôles actuels des réunions et médias, ne sont pas ouverts par cette seule acceptation.

## Affectation de l’organisateur à un rôle attendu

La page de pilotage est actuellement réservée au propriétaire du Journey, déjà participant en qualité d’organisateur. Le modèle ne possède pas encore d’association explicite entre ce participant existant et un `expectedRoleId`. L’action « M’affecter à ce rôle » reste donc un `MODEL_GAP` à traiter par une future association de rôle dédiée. Une invitation explicite de son propre profil Annuaire reste possible et conserve un consentement `PENDING` ; elle ne vaut ni affectation directe ni auto-acceptation.

### Fondation d’affectation explicite

La table `GovernedJourneyExpectedRoleAssignment` relie un Journey et l’identifiant stable d’un rôle de son snapshot à un sujet réel. Elle contient `id`, `governedJourneyId`, `relationTemplateId`, `expectedRoleId`, `assigneeUserId` nullable, `assigneeInvitationId` nullable, `assignedByUserId`, `assignedAt`, `revokedAt` nullable et `revokedByUserId` nullable.

- Une contrainte XOR impose exactement un sujet : utilisateur direct ou invitation.
- Deux clés étrangères composites partageant `relationTemplateId` garantissent que l’invitation et le Journey appartiennent au même parcours logique. Les suppressions sont restreintes pour conserver l’historique et les invariants.
- Une invitation ne rend l’affectation effective qu’après consentement `ACCEPTED` ; l’affectation ne vaut jamais consentement.
- Un index unique partiel sur `(governedJourneyId, expectedRoleId)` lorsque `revokedAt IS NULL` empêche deux titulaires actifs.
- L’historique est conservé par révocation de la ligne active, jamais par écrasement. Un remplacement explicite révoquera puis créera une nouvelle affectation dans une transaction.
- Les parcours historiques restent sans ligne d’affectation. La migration est uniquement additive et ne modifie aucune invitation, aucun consentement ni snapshot existant.

La création et la révocation fonctionnelles de ces affectations restent réservées à une étape ultérieure.
