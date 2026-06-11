# Identity / Trust - note technique staging

## Perimetre

Ce document consolide l'etat de l'axe Identity / Trust en fin de Sprint 19.7 sur
la branche `staging`.

Le perimetre actuel couvre :

- Identity Hub sur `/identity` ;
- `GoodissimaIdentity` liee a un utilisateur ou a un candidat ;
- `TrustCredential` et `TrustClaim` ;
- credential demo `VERIFIED_IDENTITY` emis par `GOODISSIMA_DEMO_AUTHORITY` ;
- Trust Admission basee sur les types de credentials requis ;
- revocation volontaire d'une attestation demo ;
- historique visible des attestations non actives.

Sont hors perimetre a ce stade :

- revocation par emetteur ;
- suspension manuelle ;
- connecteurs reels France Identite, eIDAS, banque, assurance ;
- portefeuille externe ;
- suppression physique d'une attestation.

## Modele de donnees

Les donnees principales sont dans `prisma/schema.prisma` :

- `GoodissimaIdentity` represente l'identite Goodissima d'un utilisateur ou d'un candidat.
- `TrustCredential` represente une attestation rattachee a une identite.
- `TrustClaim` porte les claims structures d'un credential.
- `CredentialType` porte le type fonctionnel, par exemple `VERIFIED_IDENTITY`.
- `TrustedOrganization` porte l'emetteur de confiance, par exemple `GOODISSIMA_DEMO_AUTHORITY`.
- `TrustPolicyCredentialRequirement` relie une Trust Policy aux types de credentials requis.

Statuts `TrustCredentialStatus` :

- `ACTIVE`
- `EXPIRED`
- `SUSPENDED`
- `REVOKED`

Champs de cycle de vie utilises :

- `issuedAt`
- `expiresAt`
- `revokedAt`
- `revocationReason`

Il n'existe pas encore de champ `suspendedAt` ni de `metadata` sur `TrustCredential`.

## Validite effective

Un credential satisfait une policy uniquement si :

- `status === ACTIVE` ;
- `expiresAt` est `null` ou strictement futur.

Cette regle est appliquee dans :

- `lib/trust-policy-evaluator.ts` via `evaluateTrustPolicy(...)` ;
- `lib/trust-credentials.ts` via `getActiveCredentialsForIdentity(...)`.

Les statuts `REVOKED`, `SUSPENDED` et `EXPIRED` sont donc exclus car ils ne sont
pas `ACTIVE`.

Un credential `ACTIVE` dont la date `expiresAt` est passee ne satisfait plus une
exigence, meme si son statut n'a pas encore ete bascule a `EXPIRED`.

## Revocation

Le point de revocation applicatif est :

- `lib/trust-credentials.ts` : `revokeTrustCredential(...)`.

Ce service :

- met `status` a `REVOKED` ;
- renseigne `revokedAt` ;
- renseigne `revocationReason` ;
- ne supprime aucune donnee.

La route produit actuellement disponible pour la revocation volontaire demo est :

- `POST /api/identity/revoke-demo-credential`

Elle cible uniquement :

- `credentialType.code === VERIFIED_IDENTITY` ;
- `issuerTrustedOrganization.organizationId === GOODISSIMA_DEMO_AUTHORITY` ;
- l'identite Goodissima de l'utilisateur connecte.

La raison renseignee est :

`Revoked by identity owner (demo)`

La route est idempotente si l'attestation demo est deja revoquee.

## Identity Hub

La page `/identity` :

- cree ou recupere l'identite Goodissima de l'utilisateur connecte ;
- affiche le statut de l'identite ;
- liste les connecteurs de confiance disponibles ou prevus ;
- permet l'emission demo d'une attestation `VERIFIED_IDENTITY` ;
- affiche les attestations actives ;
- affiche l'historique des attestations non actives ou expirees par date ;
- permet la revocation volontaire de l'attestation demo active.

La section active utilise `getActiveCredentialsForIdentity(...)`, donc elle
applique la validite effective `ACTIVE` + non expire.

L'historique utilise `getCredentialsForIdentityHistory(...)` et affiche :

- statut lisible ;
- date d'emission ;
- date d'expiration si presente ;
- date de revocation si presente ;
- raison de revocation si presente.

L'UI ne montre pas les ids techniques, les claims bruts ou le JSON brut.

## Trust Admission

Le moteur d'admission est compose de :

- `lib/trust-admission.ts` ;
- `lib/trust-policy-requirements.ts` ;
- `lib/trust-policy-evaluator.ts`.

Flux :

1. La Trust Policy expose les types de credentials requis.
2. L'identite candidate est resolue.
3. Les credentials valides de cette identite sont compares aux types requis.
4. Si un type requis manque, l'admission est refusee.

La route publique candidate est :

- `POST /api/cases`

En mode `TRUST_ADMISSION_MODE=ENFORCE`, si les exigences ne sont pas satisfaites,
la route retourne :

- HTTP `403` ;
- `code: "TRUST_ADMISSION_BLOCKED"` ;
- `error: "Admission blocked by Trust Admission requirements."` ;
- les types requis et manquants.

Le formulaire public candidat transforme ce code en message utilisateur :

`Cette relation necessite une attestation valide. Elle peut etre absente, expiree ou revoquee.`

Le message reste volontairement generique pour ne pas reveler la cause precise.

## Invariant proprietaire

La creation ou la configuration d'un lien `verified-only` depend du proprietaire
du lien et de ses droits applicatifs, pas de la validite de sa propre attestation.

La revocation de l'attestation personnelle du proprietaire ne doit donc pas
empecher la creation ou la configuration d'un lien reserve aux personnes verifiees.

La revocation impacte le sujet candidat utilise pour l'admission.

## QA

Le scenario de validation est dans :

- `scripts/qa-trust-admission-revocation.ts`

Il verifie :

- admission autorisee avec credential `VERIFIED_IDENTITY` actif ;
- admission refusee apres revocation du credential ;
- reponse publique `403` + `TRUST_ADMISSION_BLOCKED` ;
- message utilisateur explicite ;
- lien public standard toujours autorise ;
- conversation deja accordee toujours writable si la gouvernance est active ;
- proprietaire toujours capable de creer/configurer un lien `verified-only` meme
  si sa propre attestation est revoquee.

Le script est transactionnel et force un rollback volontaire en fin d'execution.

## Risques connus

- Il n'existe pas encore de test navigateur complet du formulaire public.
- Les credentials expires par date ne sont pas automatiquement bascules en statut
  `EXPIRED`.
- La suspension existe dans l'enum mais n'a pas encore de flux applicatif.
- Les connecteurs reels restent simules ou documentes, sans integration externe.
- Le workspace dossier owner peut encore afficher des credentials filtres par
  statut `ACTIVE` selon ses propres requetes ; l'invariant critique d'admission
  est porte par l'evaluateur central.
