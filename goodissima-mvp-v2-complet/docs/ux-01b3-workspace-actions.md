# UX-01B.3 — Actions contextuelles Workspace V1

## A. Résumé exécutif

Les Workspaces actifs proposent deux créations contextuelles réutilisant les flux existants. Explorer conserve uniquement ses actions Ouvrir. Aucun modèle Prisma, middleware, surface publique/invitée ou moteur IA n'est modifié par ce lot. Aucun commit automatique ; UX-01C non commencé.

## B–C. Actions ajoutées et + Nouveau

Le composant WorkspaceCreateActions est monté dans l'en-tête commun à Piloter et Explorer uniquement si le statut est ACTIVE. Son disclosure natif details/summary propose Nouveau parcours et Nouveau lien simple. Les liens transmettent un workspaceId encodé ; ce paramètre ne constitue jamais une autorisation.

## D. Parcours contextualisé

La page /gouvernance/nouveau valide le Workspace propriétaire actif avant affichage et présélectionne les sélecteurs existants, manuel et assistant. Les autres choix restent disponibles. createGovernedJourneyAction recontrôle propriétaire et statut ACTIVE dans sa transaction. Un Workspace étranger, archivé ou inconnu est refusé avant création. Le rattachement direct du parcours et les snapshots existants sont conservés.

## E. Lien simple contextualisé

La page /links/simple valide également le contexte. Le builder transmet workspaceId au POST existant. L'API vérifie le propriétaire et ACTIVE dans la transaction avant toute écriture, puis rattache directement le GLink. Le RelationTemplate technique du lien n'est pas rattaché implicitement au Workspace. Aucun dossier existant n'est modifié. Sans contexte, le flux générique reste disponible.

## F. Explorer et audit des rattachements

Ouvrir reste la seule action proposée. Aucun archivage, suppression, déplacement, détachement ou renommage n'est ajouté.

| Action existante | Contrat constaté | Décision V1 |
| --- | --- | --- |
| Rattacher/changer un parcours | Propriété via Workspace courant ou metadata.createdById ; cible propriétaire ACTIVE ; met à jour RelationTemplate et le dernier snapshot TemplateVersion en place, sans propagation aux enfants. Le wrapper de changement exige humanConfirmed ; l'action de base peut aussi remplacer un rattachement. | Conserver le flux dédié ; ne pas promouvoir en action rapide. |
| Rattacher un dossier | Dossier propriétaire et cible propriétaire ACTIVE ; peut rattacher aussi son GLink propriétaire s'il n'a pas de Workspace. | Conserver le flux dédié. |
| Détacher un dossier | Retire uniquement son workspaceId ; son GLink conserve le sien. | Conserver le flux dédié ; ne pas masquer cet effet par une action rapide. |
| Rattacher un lien | Lien propriétaire et cible propriétaire ACTIVE ; option explicite de rattachement des dossiers propriétaires encore non assignés. | Conserver le flux dédié. |
| Détacher un lien ou un parcours | Aucune mutation dédiée trouvée dans les actions Workspace examinées. | Ne pas inventer de mutation. |

L'audit porte sur lib/governance-workspace-actions.ts. Ces mutations ne sont pas modifiées. Le rattachement Workspace/Portfolio existant n'est pas promu non plus.

## G–I. Autorisations, archives et confirmations

Les pages et mutations utilisent getCurrentPrismaUser. La prélecture partage getWorkspaceCreationContext ; les mutations refont leurs propres contrôles, y compris si le Workspace a été archivé après affichage. Aucune permission canEditWorkspace fictive n'est introduite.

Un Workspace archivé reste consultable, sans + Nouveau. Les URL de création contextualisée invalides répondent par notFound. L'API lien répond 404 pour une cible indisponible et 400 pour un paramètre de type invalide ou vide. Les choix et validations humaines existants sont préservés, notamment humanValidated pour publier un lien. Aucun remplacement de relation existante n'est ajouté.

## J. Navigation

Les deux formulaires contextualisés affichent le Workspace dans le breadcrumb et proposent un retour direct vers lui. Le parcours conserve sa redirection existante vers /gouvernance/parcours/[formTemplateId]/pilotage, dont le contexte provient du rattachement persistant. Le lien simple conserve l'écran de succès et la copie de son URL publique ; un lien Consulter le lien créé mène à /links/[linkId]. Aucune redirection automatique n'est ajoutée. Les créations invalident le cache de la page Workspace. Retour/Suivant du shell sont conservés.

## K. Boussole

Le guide de maintenance a été consulté. La page Workspace conserve son absence de micro-parcours Boussole. Les cibles des formulaires guidés sont inchangées ; seule leur présélection évolue. EMPTY, POPULATED et FOCUSED ne reçoivent aucune cible fictive. Aucune étape n'est ajoutée ou retirée : journeyVersion inchangée. La maintenance complète passe ; validation humaine du lot encore à effectuer.

## L. Responsive

Chrome automatisé à 320, 390, 768, 1024 et 1440 px : absence d'overflow horizontal, ouverture clavier, tabulation sur le premier lien, focus visible, Escape avec restitution du focus, clic extérieur et navigation contextuelle vérifiés. Menu natif avec navigation nommée, dans le flux de la page.

## M. Tests

- 117 tests ciblés passent : workspace-creation, workspace-detail, workspace-pilotage, simple-link-builder, connected-shell, spatial-navigation, new-governed-journey-boussole et portfolios-boussole.
- qa:ux-01a-hardening : 33 tests passent.
- governance-attention-signals et release-v1-polish : 13 tests passent.
- qa:boussole-maintenance : passe.
- scripts/qa-connected-navigation.mjs : Chrome passe aux cinq largeurs.
- git diff --check : passe.

Les nouveaux tests exécutent les vraies pages et mutations avec dépendances contrôlées en mémoire : propriétaire actif, étranger, archivé, inconnu, présélection, absence d'écriture sur refus, archivage entre affichage et soumission, confirmations, rattachement GLink seul et redirections. Ils ne constituent pas une recette avec base réelle. Chrome utilise les composants réels dans le harnais local de navigation.

## N. Build

Compilation applicative réussie ; build non validé : le contrôle des types échoue sur la dette connue app/api/documents/upload/route.ts:128, FormData.get. Dette laissée hors périmètre comme demandé. Une vérification TypeScript séparée sans m1a ni .next retrouve seulement les deux diagnostics QA connus : TS2352 dans qa/candidate-form-safety.test.ts:28 et TS7023 dans qa/matching-lifecycle.test.ts:27. Aucun nouveau diagnostic imputable au lot.

## O. Risques et dettes séparées

### Sécurité — archivage de template, hors périmètre

/api/templates/[templateId]/archive authentifie l'appelant mais son contrôle propriétaire reste insuffisant. Cette dette nécessite un lot de sécurité dédié. Route non modifiée et action non exposée dans Explorer ou Piloter.

### Autres réserves

AI-WORKSPACE-SCOPE inchangé. Le flux générique historique de création de parcours par nom utilise toujours un upsert pouvant réactiver un Workspace archivé de même slug ; les créations par workspaceId contrôlées dans ce lot le refusent. Aucun mécanisme de verrouillage supplémentaire contre un archivage concurrent n'est introduit. Les contrats de rattachement/détachement ci-dessus restent réservés aux pages métier. Recette humaine à réaliser avant validation du lot.

## P. Diff du lot

- Nouveaux : components/WorkspaceCreateActions.tsx, lib/workspace-creation-context.ts, qa/workspace-creation.test.ts, ce rapport.
- Interface : components/WorkspaceDetailView.tsx ; pages connectées gouvernance/nouveau et links/simple ; props de présélection GovernanceJourneyAssistant et SimpleLinkBuilder.
- Serveur : lib/governance-journey-actions.ts et app/api/links/simple/route.ts.
- QA : qa/workspace-detail.test.ts, qa/simple-link-builder.test.ts, scripts/qa-connected-navigation.mjs, commande qa:workspace-creation dans package.json.

Le dépôt contient également les modifications des lots précédents ; elles ne sont pas attribuées à UX-01B.3.

UX-01B.3 :

- [ ] prêt
- [x] prêt avec réserves
- [ ] bloqué
