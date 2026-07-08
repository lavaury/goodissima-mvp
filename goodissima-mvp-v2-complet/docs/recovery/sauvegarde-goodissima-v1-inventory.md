# Inventaire de recuperation - sauvegarde-goodissima-v1-staging

## Perimetre

Inventaire realise depuis la branche propre `recette-goodissima-v1-clean`, par lecture de la branche `sauvegarde-goodissima-v1-staging` sans restauration de code applicatif.

Objectif : identifier ce qui peut etre recupere plus tard sans casser le socle V1 actuel :

- `/gouvernance` honnete ;
- creation de parcours gouverne avec assistance IA et validation humaine ;
- cockpit minimal `/gouvernance/parcours/[id]/pilotage` ;
- invitations participant metadata-only ;
- receptions documentaires metadata-only.

Aucune modification Prisma, aucune migration, aucune route runtime, aucun composant restaure.

## Synthese de recuperabilite

| Niveau | Sens |
| --- | --- |
| A | Recuperable vite, avec risque faible et adaptation locale. |
| B | Recuperable apres adaptation explicite au schema propre et au cockpit minimal. |
| C | A reconstruire plus tard, car le module suppose un runtime ou un schema absent. |
| D | A abandonner ou a ne pas restaurer tel quel. |

## Inventaire par fonctionnalite

### Pilotage avance - JourneyPreparationPilotage

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `components/JourneyPreparationPilotage.tsx`, `app/gouvernance/[workspace]/pilotage/page.tsx`, `app/gouvernance/[workspace]/page.tsx` |
| Equivalents dans la branche propre | `app/gouvernance/parcours/[id]/pilotage/page.tsx`, `lib/governance-participant-invitations-actions.ts`, `lib/governance-document-receptions-actions.ts` |
| Dependances directes | `lib/journey-intent`, `lib/governed-discovery`, `components/DiscoveryInvitationPanel`, `lib/document-actions`, `lib/journey-review-actions`, `lib/communication-session-actions`, `lib/governance-policy` |
| Donnees demo ou risques | Melange invitation, documents reels, revue de gouvernance et communication protegee dans un seul cockpit. Le composant manipule des statuts comme invitation envoyee, document valide ou communication active, alors que la V1 propre ne doit pas envoyer, valider ni ouvrir d'acces automatiquement. |
| Recuperabilite | C pour restauration complete ; B pour extraire plus tard des idees d'ergonomie. |
| Sprint futur recommande | Sprint de reconstruction cockpit V1.2 apres stabilisation des modeles invitation/document/review. Ne pas importer le composant tel quel. |

### DiscoveryInvitation

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `components/DiscoveryInvitationPanel.tsx`, `lib/governed-discovery.ts`, `lib/discovery-invitation-actions.ts`, `lib/discovery-invitation-repository.ts`, `lib/discovery-invitation-repository-provider.ts` |
| Equivalents dans la branche propre | `lib/governance-participant-invitations-actions.ts` et affichage metadata-only dans `app/gouvernance/parcours/[id]/pilotage/page.tsx`. `lib/access-invitations.ts` existe mais reste global par email, non relie a un parcours. |
| Dependances directes | Modele Prisma `DiscoveryInvitation`, `GovernancePolicy`, generation de lien securise, QR code, repository Prisma ou mock. |
| Donnees demo ou risques | Le panneau contient des actions accept/refuse simulees et expose lien securise/QR. La policy interdit l'acces direct avant acceptation, mais le module suppose deja une table Prisma absente de la branche propre. |
| Recuperabilite | B. Le domaine est interessant, mais doit etre rebranche sur un modele decide et sur le vocabulaire V1 "preparee, non envoyee". |
| Sprint futur recommande | Sprint "Invitation privee V1.2" : transformer les metadata 8K en vraie invitation persistable seulement apres decision schema. |

### JourneyReview

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `components/JourneyReviewPanel.tsx`, `lib/journey-review.ts`, `lib/journey-review-actions.ts`, `lib/journey-review-repository.ts`, `lib/journey-review-repository-provider.ts` |
| Equivalents dans la branche propre | Aucun module review complet. Le cockpit propre affiche seulement les premieres actions issues du plan de creation. |
| Dependances directes | Modele Prisma `JourneyReview`, `CommunicationSession`, `GovernedDocument`, `JourneyProjection`, `RelationalMemory`, `RelationshipState`, `GovernancePolicy`. |
| Donnees demo ou risques | Le module parle de reunion, synthese IA, decisions humaines, actions proposees et notifications. Il doit rester strictement soumis a validation humaine pour ne pas creer de workflow automatique. |
| Recuperabilite | B pour les types et le panneau read-only ; C pour le runtime complet. |
| Sprint futur recommande | Sprint "Revue de gouvernance metadata-first" apres documents et invitations reelles. Commencer par une revue preparee, non executee. |

### CommunicationSession

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `lib/communication-session.ts`, `lib/communication-session-actions.ts`, `lib/communication-session-repository.ts`, `lib/communication-session-repository-provider.ts`, `components/LiveKitProtectedAudioCall.tsx`, `lib/relational-media.ts` |
| Equivalents dans la branche propre | Aucun equivalent runtime. |
| Dependances directes | Modele Prisma `CommunicationSession`, policy de gouvernance, participants, presence, consentement, media provider. |
| Donnees demo ou risques | Risque eleve d'ouverture de session, canal audio/video, consentement implicite ou impression de contact automatique. Le flux V1 propre interdit contact et workflow automatique. |
| Recuperabilite | C. |
| Sprint futur recommande | Sprint media separe, derriere feature flag, apres conception explicite consentement/acces/session. |

### Documents - upload, liste et actions

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `components/DocumentUpload.tsx`, `components/DocumentList.tsx`, `lib/document-actions.ts`, `app/api/documents/route.ts`, `app/api/documents/upload/route.ts`, `app/api/documents/[documentId]/signed-url/route.ts`, `emails/NewDocumentEmail.tsx` |
| Equivalents dans la branche propre | `components/DocumentUpload.tsx`, `components/DocumentList.tsx`, `app/api/documents/*`, `emails/NewDocumentEmail.tsx`, plus `lib/governance-document-receptions-actions.ts` pour la reception metadata-only du cockpit gouvernance. |
| Dependances directes | Modele Prisma `Document`, `RelationCase`, upload fichier, URL signee, email. Dans la sauvegarde, `lib/document-actions.ts` cherche des documents via un `RelationCase.journeyId`. |
| Donnees demo ou risques | Incompatible avec Sprint 8L si restaure dans le cockpit : 8L declare une reception sans fichier stocke et sans validation automatique. Risque d'email ou de fichier reel si le flux upload est branche trop tot. |
| Recuperabilite | B pour reutiliser UI/API hors cockpit ; C pour gouvernance tant que le lien parcours-document n'est pas tranche. |
| Sprint futur recommande | Sprint "Documents gouvernes V1.2" : decider d'abord comment un parcours gouverne se lie a `RelationCase` ou a un futur modele document. |

### GovernedDocument

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `lib/governed-document.ts`, `components/GovernedDocumentWorkspace.tsx`, `lib/governed-document-demo.ts` |
| Equivalents dans la branche propre | Reception documentaire metadata-only uniquement : `lib/governance-document-receptions-actions.ts`. |
| Dependances directes | `GovernancePolicy`, versions de document, partage, references, preuves, timeline documentaire. |
| Donnees demo ou risques | `lib/governed-document-demo.ts` est explicitement demo. Le domaine introduit partage externe, production, archivage et preuves, au-dela de la V1 actuelle. |
| Recuperabilite | B pour le modele conceptuel ; D pour les donnees demo. |
| Sprint futur recommande | Extraire uniquement le vocabulaire de cycle documentaire apres le sprint documents reels. |

### Annuaire, directory, contacts et participants

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `app/annuaire/page.tsx`, `components/DirectoryJourneyDemo.tsx`, `DIRECTORY_USER_EXPERIENCE_V1.md`, `GOODISSIMA_DISCOVERY_DIRECTORY_CHECKPOINT.md` |
| Equivalents dans la branche propre | Aucun annuaire runtime. Les participants attendus viennent du plan de creation dans `TemplateVersion.snapshot.metadata.creationPlan`. |
| Dependances directes | `lib/goodissima-repository-provider`, `lib/goodissima-client-actions`, `lib/goodissima-contracts`, composants de demo guidee. |
| Donnees demo ou risques | `app/annuaire/page.tsx` charge `DirectoryJourneyDemo` et `GuidedGoodissimaDemo`. `DirectoryJourneyDemo` contient des donnees de parcours guide comme conseil fiscal, expert-comptable, Lyon, Marie Laurent et Jean. |
| Recuperabilite | B pour les principes UX ; D pour restauration telle quelle. |
| Sprint futur recommande | Sprint annuaire separe : repartir d'un formulaire vide et de donnees persistantes, pas des scenarios demo. |

### Audio, video, media et call

| Champ | Inventaire |
| --- | --- |
| Fichiers trouves dans la sauvegarde | `lib/media/types.ts`, `lib/media/factory.ts`, `lib/media/livekit.ts`, `lib/media/livekit-config.ts`, `lib/media/livekit-stub.ts`, `lib/media/mock.ts`, `app/api/dev/media-provider/*`, `app/dev/media-lab/*`, `app/api/cases/[caseId]/media/protected-call/route.ts`, `app/api/cases/[caseId]/media/transcription-consent/route.ts`, `components/LiveKitProtectedAudioCall.tsx`, `components/RelationalMediaDemoPanel.tsx`, `components/RelationalPresenceMediaDemo.tsx` |
| Equivalents dans la branche propre | Aucun equivalent media/call. |
| Dependances directes | LiveKit ou provider mock, sessions media, tokens participants, consentement transcription, routes case-based. |
| Donnees demo ou risques | Routes de laboratoire et provider dev. Risque de donner l'impression qu'un appel, une publication audio/video ou une transcription sont disponibles en V1. |
| Recuperabilite | C. |
| Sprint futur recommande | Sprint media apres CommunicationSession, avec feature flag et consentement explicite. |

## Ne pas restaurer tel quel

Les elements suivants sont a risque et ne doivent pas etre restaures directement dans la branche propre :

- `app/gouvernance/parcours/nouveau/page.tsx` : ancienne page de creation demo a bannir du flux V1.
- `app/intention-workshop/page.tsx` : ancien workshop lie a des scenarios et workspaces de demonstration.
- `app/gouvernance/migration/page.tsx` : page de migration avec donnees et libelles non compatibles recette propre.
- `components/GovernanceWorkspaceCreateForm.tsx` : exemples de workspaces/metiers predefinis non compatibles avec la gouvernance honnete V1.
- `components/JudgeJourneyPanel.tsx` : panneau oriente scenario demo.
- `components/DirectoryJourneyDemo.tsx` et `components/GuidedGoodissimaDemo.tsx` : parcours annuaire guide, donnees non saisies par l'utilisateur.
- `lib/governed-document-demo.ts` : donnees documentaires demo.
- `components/RelationalMediaDemoPanel.tsx`, `components/RelationalPresenceMediaDemo.tsx`, `app/dev/media-lab/*`, `app/api/dev/media-provider/*` : laboratoire media/dev, pas runtime recette.
- `components/JourneyPreparationPilotage.tsx` : trop large pour une restauration directe ; il suppose invitations, documents, reviews et communications completes.
- `lib/document-actions.ts` depuis la sauvegarde : suppose un lien `RelationCase.journeyId` et ne respecte pas le mode metadata-only du Sprint 8L.
- Toute migration Prisma issue de la sauvegarde : hors perimetre, schema a ne pas modifier.

## Ordre de recuperation recommande

1. **Invitation privee V1.2** : partir des metadata 8K, definir le modele cible, puis adapter les concepts de `DiscoveryInvitation` sans lien/QR actif par defaut.
2. **Documents gouvernes V1.2** : decider le lien entre parcours gouverne, `RelationCase` et fichier stocke avant de reutiliser `DocumentUpload`, `DocumentList` ou `document-actions`.
3. **Revue de gouvernance preparee** : introduire une review read-only ou metadata-first, sans notification ni action automatique.
4. **Annuaire relationnel** : reconstruire un flux sans donnees guidees, avec saisie utilisateur et contacts persistants reels.
5. **CommunicationSession** : ajouter seulement apres consentement, participants reels, invitations reelles et feature flag.
6. **Media audio/video** : brancher LiveKit ou mock uniquement apres CommunicationSession ; garder les routes dev hors recette.
7. **Cockpit avance** : reconstruire un cockpit modulaire a partir des briques propres, au lieu de restaurer `JourneyPreparationPilotage`.

## Conclusion

La sauvegarde contient des briques utiles, mais aucune des grandes fonctionnalites avancees ne doit etre restauree en bloc. Les modules les plus proches d'une recuperation sont `DiscoveryInvitation` et les composants documentaires, a condition de les adapter au schema propre et aux garanties V1 : pas d'envoi automatique, pas de fichier invente, pas d'acces ouvert, pas de workflow automatique.

Le prochain sprint le plus coherent est une invitation privee V1.2 fondee sur les metadata 8K, avant toute restauration de cockpit avance.
