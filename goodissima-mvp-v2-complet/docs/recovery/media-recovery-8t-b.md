# Goodissima Sprint 8T-B - Media relationnel

## Diagnostic cible

Fichiers actuels utiles :
- `prisma/schema.prisma` : `CommunicationSession`, `CommunicationChannelType`, `CommunicationSessionStatus`, `CommunicationProvider`, liens vers `RelationCase`, `RelationTemplate` et `Workspace`.
- `lib/governance-communication-session-actions.ts` : preparation V1 de sessions gouvernance sans media automatique.
- `lib/governance-workspace-repository.ts` : libelles et compteurs de sessions de communication par Workspace/parcours.
- `app/gouvernance/parcours/[id]/pilotage/page.tsx` : cockpit gouvernance minimal avec preparation de communications.
- `app/cases/[caseId]/page.tsx` et `components/RelationCaseWorkspace.tsx` : page relationnelle reelle a brancher.

Fichiers et approches exclus :
- `app/dev/media-lab`, `app/api/dev/media-provider`, `RelationalMediaDemoPanel`, `RelationalPresenceMediaDemo`.
- Tout composant demo ou donnees de demonstration.
- Tout branchement LiveKit, token public, lien public non decide, email, notification, enregistrement, transcription ou workflow automatique.

La sauvegarde `sauvegarde-goodissima-v1-staging` n'est pas presente dans ce workspace au moment du sprint. Aucun code de sauvegarde n'a ete restaure.

## Choix d'integration

Le sprint ajoute une route relationnelle produit :
- `app/api/cases/[caseId]/media/protected-call/route.ts`

Cette route verifie le proprietaire courant, charge une `RelationCase` reelle, recupere le `workspaceId` depuis `RelationCase.workspaceId` puis `GLink.workspaceId`, et cree ou retrouve une `CommunicationSession` V1 liee au dossier.

Le composant client :
- `components/RelationSecureMediaCall.tsx`

Il affiche trois actions explicites : audio, visio et partage d'ecran. `getUserMedia` et `getDisplayMedia` ne sont appeles que dans les gestionnaires de clic. Les flux sont locaux au navigateur, arretables immediatement, et ne pretendent pas ouvrir un appel distant multi-utilisateur.

## Limites V1

- Provider distant : non branche en V1 (`CommunicationProvider.NONE`).
- Enregistrement : desactive.
- Transcription : desactivee.
- Notification automatique : non envoyee.
- Token media/public : non genere.
- Acces public : non ouvert automatiquement.
- Workflow automatique : non demarre.
