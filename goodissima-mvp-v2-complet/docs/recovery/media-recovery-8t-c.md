# Goodissima Sprint 8T-C - Communication distante candidat/proprietaire

## Diagnostic relation/candidat

Acces proprietaire :
- `app/cases/[caseId]/page.tsx` charge une `RelationCase` reelle par `ownerId`.
- `components/RelationCaseWorkspace.tsx` rend l'espace relationnel proprietaire.

Acces candidat :
- `app/secure/[token]/page.tsx` utilise `RelationCase.candidateAccessToken` via `activeCandidateAccessWhere`.
- Le candidat voit deja la conversation, les documents et les demandes dans le meme composant `RelationCaseWorkspace`.
- Aucun nouveau lien candidat n'est cree pour le media.

## Provider media retenu

LiveKit n'est pas configure comme provider operationnel dans la branche ; l'enum existant contient seulement `LIVEKIT_PENDING`.

Le sprint utilise donc un provider WebRTC navigateur minimal :
- `RTCPeerConnection` cote navigateur ;
- signalisation HTTP pollée via routes Goodissima ;
- stockage de signalisation en memoire processus, sans nouvelle table Prisma ;
- `CommunicationSession.provider = MANUAL_EXTERNAL` pour distinguer ce mode du provider local `NONE`.

## Routes ajoutees

- Proprietaire : `app/api/cases/[caseId]/media/protected-call/route.ts`
- Candidat : `app/api/candidate/cases/[caseId]/media/protected-call/route.ts`
- Signalisation proprietaire : `app/api/cases/[caseId]/media/signaling/route.ts`
- Signalisation candidat : `app/api/candidate/cases/[caseId]/media/signaling/route.ts`

Les routes candidat verifient le `candidateAccessToken` existant, son expiration et sa revocation via `activeCandidateAccessWhere`.

## Limites V1

- Pas de LiveKit ni TURN serveur.
- La signalisation est en memoire processus ; elle convient au socle V1 et au serveur Next courant, mais n'est pas une file durable multi-instance.
- Les statuts Prisma existants ne contiennent pas `READY`, `ACTIVE` ou `ENDED`. Le sprint utilise `REQUESTED` sans migration.
- Aucun email, aucune notification automatique, aucun enregistrement, aucune transcription, aucun token media et aucun nouveau lien public ne sont generes.
