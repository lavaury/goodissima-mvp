# DEBT-AUTH-01 — Autorisation serveur des templates

Baseline : `510f4de1edbf3550e8e9258f8c2eb6713c32e700`, branche `hotfix/privacy-noindex-production`.
Statut : implémentation validée techniquement, **prêt avec réserves**. Aucun commit/push. Aucun changement Prisma, UX ou logique IA.

## Décision produit et cause

Décision produit explicite : absence de propriété démontrable = absence de droit de mutation. Aucun partage déduit de isDefault, de l'ancienneté, de la visibilité ou de l'absence de Workspace. Aucun propriétaire ni destination de copie inventé. Les objets indéterminables sont refusés jusqu'à attribution explicite, hors de ce lot.

Le schéma et les écritures existantes établissent ce cas : `RelationTemplate` possède `workspaceId?`, mais ni ownerId ni createdById. `FormTemplate` ne possède pas davantage de propriétaire. `POST /api/templates` et l'ancienne duplication créent des objets sans Workspace, auteur, génération ou version de provenance. Une création manuelle non utilisée peut donc ne porter **aucune preuve de propriété**. Ce n'est pas seulement une difficulté de requête.

Aucune donnée de production n'a été interrogée. La présence effective et le nombre de ces objets dans les environnements ne sont pas mesurés. Le code permet leur existence et continue de pouvoir les créer.

## Modèle observé

| Cas | Source existante | Conclusion |
| --- | --- | --- |
| Template rattaché | `RelationTemplate.workspace.ownerId` (`prisma/schema.prisma`, Workspace / RelationTemplate) | Source explicite. Le propriétaire du Workspace doit être vérifié ; sa simple présence ne suffit pas. |
| Ancien parcours gouverné | `TemplateVersion.snapshot.metadata.createdById`, marqué par la création gouvernée | Sans Workspace uniquement : version initiale 1 portant `metadata.source === "governance-v1-minimal-create"`. La provenance d'une édition ultérieure seule n'accorde aucun droit. |
| Génération IA validée | `TemplateGeneration.createdById`, liaison `templateId` après validation | Sans Workspace uniquement : génération VALIDATED avec validatedAt renseigné, liée au template. Créateurs distincts ou preuves historiques contradictoires : refus. |
| Template utilisé par des liens/dossiers | `GLink.ownerId`, `RelationCase.ownerId` | Propriétaire d'une utilisation, pas preuve automatique de propriété du modèle ; ne pas transformer ce lien en droit de mutation. |
| Création manuelle / copie historique | Aucune propriété persistée à la création | Attribution impossible à garantir à partir du seul objet. |
| Démonstration / modèle commun éventuel | Seeds, `isDefault` | `isDefault` sert au tri dans `app/(connected)/links/new/page.tsx`. Aucune ACL de partage démontrée ; un template sans Workspace n'est pas automatiquement public. |

Preuves : `app/api/templates/route.ts:101`, `app/api/templates/[templateId]/duplicate/route.ts:29`, `prisma/schema.prisma:612`, `prisma/schema.prisma:687`, `prisma/schema.prisma:1034`, `lib/governance-workspace-actions.ts:174`, `docs/recovery/workspace-backfill.md`, `scripts/seed-demo-templates.mjs:141`.

## Cartographie des mutations — état avant correction

Dans `/api/templates/[templateId]`, le paramètre désigne **FormTemplate.id**, résolu en RelationTemplate.id par le contrôle commun. Sauf mention contraire, les handlers accèdent directement au repository Prisma (`@/lib/prisma`). Le tableau décrit les comportements observés sur la baseline ; la couverture finale est précisée après le tableau.

| Opération / route | Service / repository / comportement historique | Contrôle observé |
| --- | --- | --- |
| POST `/api/templates/[templateId]/archive` | Prisma : lecture du formulaire et template, compte des liens actifs, update statut ARCHIVED | Authentification seulement. 404 absent, 409 liens actifs sans confirm ; confirm autorise l'archivage sans vérifier le propriétaire. |
| DELETE `/api/templates/[templateId]` | Prisma : compte links/relationCases, suppression formulaire puis template dans une transaction | Authentification seulement. 404 absent, 409 si non DRAFT ou utilisé. La transaction ne remplace pas l'autorisation. |
| POST `/api/templates/[templateId]/duplicate` | Prisma : copie template/formulaire/champs dans une transaction, nouveau DRAFT | Authentification seulement ; copie sans Workspace ni auteur. Aucune attribution du nouvel objet garantie. |
| POST `/api/templates/[templateId]/publish` | `buildTemplateSnapshot` dans `lib/template-snapshots.ts`, sécurité du formulaire candidat, Prisma versions et statut PUBLISHED | Aucun contrôle propriétaire dans le handler ou le chargement du snapshot. |
| POST `/api/templates/[templateId]/lifecycle` | `transitionOpportunity`, Prisma statut + événement | `humanConfirmed` et transition métier, aucun contrôle propriétaire du template. Peut notamment agir sur le cycle de vie en parallèle de l'archivage dédié. |
| PATCH `/api/templates/[templateId]/ai-instructions` | Nettoyage du texte, Prisma update, enqueueEmbeddingJob | Authentification sans propriétaire ; cartographié, logique IA non modifiée. |
| POST `/api/templates/[templateId]/fields` | Prisma création FormField | Authentification et validation de champs, pas de propriété du formulaire. |
| PATCH/DELETE `/api/templates/fields/[fieldId]` | Prisma update/delete du champ par id | Authentification sans remontée au propriétaire du template. Mutation voisine indirecte. |
| POST `/api/templates/[templateId]/manual-versions` | `manual-journey-editor`, `parseTemplateSnapshot`, Prisma version + historique | Version liée au template, règles de brouillon ; userId tracé mais pas d'autorisation propriétaire du template. |
| POST `/api/templates/[templateId]/critic` | `analyzeTemplateVersionQuality`, Prisma rapport | Lit le contenu du template et crée un rapport pour l'appelant sans propriétaire du template vérifié. |
| POST `/api/templates/[templateId]/critic/[reportId]/optimize` | Optimisation et Prisma | Rapport filtré par createdById et template ; cela ne constitue pas une autorisation initiale sur le template source. |
| POST `/api/templates/[templateId]/optimizations/[optimizationId]/approve` | Prisma version dérivée / optimisation | Optimisation filtrée par createdById et template ; pas de contrôle du propriétaire du template lui-même. |
| POST `/api/templates` | Prisma création manuelle | Utilisateur authentifié, auteur non enregistré. Source du problème historique et futur. GET global signalé uniquement pour comprendre l'ancien catalogue ; lecture non modifiée. |
| POST `/api/templates/ai-generate/[generationId]/validate` | Prisma template/formulaire + liaison génération | Génération filtrée par createdById de l'appelant ; crée le template sans Workspace mais conserve cette provenance. |
| Création gouvernée (server action) | `lib/governance-journey-actions.ts`, Prisma | Workspace propriétaire sélectionné/créé, workspaceId écrit sur template et createdById dans métadonnées. |
| Rattachement gouverné (server action) | `lib/governance-workspace-actions.ts`, Prisma | Workspace cible actif propriétaire ; autorisation source par métadonnées **ou** propriétaire du Workspace actuel. Cette règle spécifique ne doit pas être généralisée implicitement aux autres mutations. |
| POST `/api/links/simple` | Prisma création template + lien | Workspace optionnel vérifié propriétaire ; le lien conserve son owner. Ne définit pas une politique universelle de propriété template. |
| Seeds/backfill/promotions | Scripts Prisma, dont `seed-demo-templates.mjs`, `seed-dev-ai.mjs`, `promote-investor-template.mjs` | Outillage hors API ; modèles sans propriétaire possibles. Ne pas exécuter ni modifier ces scripts pour attribuer les objets implicitement. |

Les routes de génération/révision avant validation filtrent la génération par auteur ; elles ne résolvent pas l'autorisation des templates manuels existants. Aucun changement de ces flux dans ce lot.

## Autorisation commune implémentée

`lib/template-mutation-access.ts` exporte `getTemplateMutationAccess(user, formTemplateId)` et la réponse de refus commune. La fonction charge seulement les identifiants du formulaire/template et le propriétaire Workspace. En présence de workspaceId, seul le propriétaire de ce Workspace est autorisé ; une relation Workspace manquante refuse l'accès. Aucune provenance historique ne contourne un Workspace étranger.

Sans Workspace, elle charge au plus deux créateurs distincts de générations validées et le snapshot de la version initiale. Seules les preuves de création décrites dans le tableau sont admises. Un unique créateur correspondant à l'utilisateur est requis ; aucune preuve ou plusieurs créateurs = refus. Les liens/dossiers, isDefault et auteurs de rapports/modifications ultérieurs n'accordent aucun droit.

Les 11 handlers sous `[templateId]` du tableau appellent ce service immédiatement après authentification, avant lecture du corps et traitement métier. Les PATCH/DELETE de champs remontent au formulaire puis appliquent le même service. Aucun calcul IA ni règle de publication/modification des versions n'est modifié.

Le rattachement et son alias `changeGovernedJourneyWorkspaceAction` appliquent aussi cette garde avant leur logique existante : l'ancien OR sur metadata.createdById ne peut plus servir à récupérer un template attaché à un autre propriétaire. Le Workspace cible actif propriétaire et les contraintes de version restent vérifiés comme auparavant.

## Archive, suppression, copie et réponses

Objet absent, étranger ou sans provenance : **404 uniforme** `Parcours introuvable.`, sans divulguer statut/champs/compte de liens. Les trois handlers principaux conservent la redirection login de `getCurrentPrismaUser` pour les anonymes, vérifiée comme interruption avant toute lecture template. Les catches historiques de certains handlers voisins sont conservés ; leur normalisation HTTP globale n'est pas incluse.

Archivage : compte des liens actifs seulement après autorisation. 409 sans confirmation ; confirm:true n'accorde jamais l'autorisation. Suppression : contraintes DRAFT et absence de links/relationCases conservées ; suppression formulaire/template dans la transaction existante. Aucun des deux DELETE n'est appelé après refus.

Copie : source autorisée requise même si la destination appartient à l'appelant. JSON attendu : `{ "workspaceId": "identifiant-explicite" }`. Le serveur vérifie id + ownerId + status ACTIVE. La copie DRAFT est créée directement avec ce workspaceId dans la transaction de copie formulaire/champs, sans CREATE puis UPDATE, sans modifier la source. Destination absente : 409 `WORKSPACE_TARGET_REQUIRED` ; valeur invalide : 400 ; destination étrangère/inexistante/archivée : 404.

Le flux UI historique n'envoie pas de Workspace cible et aucun contexte de destination validé n'y est établi. Il reçoit donc le refus 409 ; ni le Workspace source ni un premier Workspace disponible ne sont utilisés implicitement. L'ajout d'une destination dans l'UI est un besoin produit futur, sans modification UX ici. Aucune copie personnelle non rattachée n'est créée, car sa propriété ne serait pas persistée par le modèle existant.

## Validation

- `npm run typecheck` : zéro diagnostic.
- `npm run build` : compilation et typage réussis, 61/61 pages générées. Avertissements de cache webpack déjà connus, non bloquants.
- `qa/template-mutation-access.test.ts` : **43 tests** des handlers/actions réels avec Prisma/session/services doublés. Utilisateurs A et B, accès propres, refus étranger/absent/anonyme, historiques validés/indéterminés, preuves contradictoires, priorité Workspace, champs et mutations voisines, copie dans un autre Workspace propre, rattachement sans contournement.
- Ensemble templates/publication/formulaire/éditeur, sécurité, Workspace/Portfolio, Mes espaces/Accueil, navigation/shell, upload et périmètre web : **256/256** (dont les 43 ci-dessus).
- `npm run qa:boussole-maintenance` : **55/55**. Aucune surface/cible/version Boussole modifiée.
- D-020 : reste OPEN. Les deux assertions historiques ne sont ni corrigées, ni retirées, ni masquées.
- UTF-8 et `git diff --check` : conformes.

Commande reproductible des 256 tests :

```sh
node --experimental-strip-types --test qa/template-mutation-access.test.ts qa/candidate-form-safety.test.ts qa/announcement-publication.test.ts qa/manual-journey-editor.test.ts qa/opportunity-domain.test.ts qa/workspace-detail.test.ts qa/workspace-creation.test.ts qa/workspace-portfolio-creation.test.ts qa/workspace-pilotage.test.ts qa/spaces.test.ts qa/portfolio-explorer.test.ts qa/dashboard-home.test.ts qa/dashboard-glink-polish.test.ts qa/connected-shell.test.ts qa/spatial-navigation.test.ts qa/governed-invitation-access.test.ts qa/feedback-url.test.ts qa/document-upload.test.ts qa/web-typecheck.test.ts
```

Les doubles vérifient l'ordre des refus et l'absence d'écriture ; aucune mutation sur base réelle, aucun appel IA externe, aucune recette navigateur avec données de production. Pas de nouvelle politique de verrouillage concurrent ou migration de provenance historique dans ce lot ; une attribution historique explicite devra vérifier l'intégrité de ses données.

## Diff et réserves

18 fichiers : 12 fichiers de routes (13 handlers), service commun, action Workspace, nouveau test d'autorisation, adaptation du double du test de création Workspace, registre et rapport. Aucun changement Prisma, UX, algorithme IA, D-002/D-016/D-019, D-020 ou UX-02. m1a, logs et cache de build exclus ; aucun commit/push.

Le registre conserve l'audit antérieur, enregistre `510f4de1...` pour D-001/D-017 et clôt la correction D-003/D-018 techniquement, sans hash de résolution inventé. Besoins séparés : attribution/migration des historiques sans preuve, création manuelle avec propriété persistée, sélection explicite d'une destination de copie, futur modèle de partage. Les créations manuelles hors Workspace restent possibles dans l'ancienne route et produisent des objets désormais non mutables sans preuve : limite explicitement conservée, pas de réattribution automatique.

Verdict : **prêt avec réserves**, recette humaine et jalon de publication à effectuer séparément.
