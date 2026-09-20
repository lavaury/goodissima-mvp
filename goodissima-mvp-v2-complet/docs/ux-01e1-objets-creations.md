# UX-01E.1 — Contrat des objets et créations

Validation du 2026-09-08. Implémentation non commitée, non poussée, à soumettre à la revue humaine. Aucun autre lot entrepris.

## A. Baseline

Branche `hotfix/privacy-noindex-production`. HEAD et référence locale `origin/hotfix/privacy-noindex-production` : `92b5711dcf97361d4e2c9d0f2d34390f5c269b30`. Aucun fetch/push dans cette intervention. État initial : aucun fichier suivi modifié, `m1a/` seul non suivi. Typecheck initial réussi.

## B–C. Contrat et classification

Le Workspace est facultatif pour les trois objets. Il ne remplace jamais la preuve de propriété.

| Objet | Support réel et classification | Propriété |
| --- | --- | --- |
| Lien simple | GLink avec `rules.simpleLink === true` ; RelationTemplate/FormTemplate de support | `GLink.ownerId` issu de la session |
| Opportunité | GLink créé par le flux annonce existant ; nouveau marqueur serveur `rules.creationSource === "opportunity"` | `GLink.ownerId` ; USE du template vérifié séparément |
| Parcours gouverné | RelationTemplate + FormTemplate + TemplateVersion initiale | Workspace propriétaire, ou provenance initiale reconnue par DEBT-AUTH-02 |

Il n'existe pas de modèle Prisma Opportunity. L'absence de `simpleLink` ne suffit pas à classifier un GLink. `linkObjectLabel` donne priorité au lien simple, puis au marqueur positif Opportunité ; sinon « Lien ». Mes espaces et Workspace réutilisent cette fonction sans créer une deuxième ligne pour un même GLink.

Le template technique créé par le builder simple n'a ni Workspace, ni génération validée, ni version initiale de création gouvernée. La lecture des parcours sans Workspace intersecte déjà les preuves READ : ce support ne devient donc pas un parcours gouverné visible. Aucune permission supplémentaire n'est ajoutée pour le rendre visible. Les vrais templates réutilisables du flux assisté conservent leurs lectures existantes ; aucune taxonomie générale ou migration historique n'est introduite.

## D. Mes espaces + Nouveau

Le menu natif existant expose, dans cet ordre : Portfolio, Workspace, Lien simple, Opportunité, Parcours gouverné. Les routes des deux premières créations sont conservées ; les trois dernières ouvrent les builders existants. Le menu Portfolio reste limité à la création Workspace contextualisée.

## E–F. Création globale et contextualisée

Depuis Mes espaces, aucun `workspaceId` n'est envoyé et aucun sélecteur n'est demandé. Depuis un Workspace actif propriétaire, les trois entrées conservent son identifiant explicite. Les pages revalident le contexte ; les créations finales revalident existence, propriétaire courant et statut ACTIVE dans la transaction qui crée l'objet directement avec son `workspaceId`.

Une valeur explicitement vide, malformée, étrangère, archivée ou inconnue ne devient jamais une création globale. Les requêtes JSON malformées sont refusées (400 ou 404 selon la frontière) ; les actions serveur gouvernées lèvent une erreur sans écriture. Les valeurs FormData multiples sont refusées. Aucun owner fourni par le client ne fait foi.

## G. Lien simple

Réemploi de `/links/simple` et de `POST /api/links/simple`, sans changement du contrat serveur existant. La valeur globale omise est persistée à null par Prisma. Seul le GLink reçoit le Workspace contextualisé ; ses supports techniques ne sont pas rattachés. Les confirmations et règles de non-envoi restent inchangées. Après succès, ouverture de `/links/[id]`.

## H. Opportunité

Transport explicite du contexte dans `/opportunities/new`, la branche manuelle `/links/new`, le composant AITemplateDesigner et ses requêtes generate/revise/validate. Après validation assistée, conservation du paramètre sur `/templates/[FormTemplate.id]`, la modification, la vue avancée et la création finale du GLink.

Les API assistées revalident un contexte fourni avant traitement. Le brouillon intermédiaire conserve son mécanisme de propriété par génération validée ; il n'est pas déplacé dans un Workspace. L'objet final GLink reçoit directement le contexte revalidé dans sa transaction. Aucun CREATE puis UPDATE.

Le catalogue est filtré par USE. Une sélection explicite hors catalogue reçoit désormais 404 sur le formulaire, au lieu du repli UI antérieur. L'API recontrôle USE sans fallback pour un identifiant explicitement interdit/inexistant. `suppressNotification: true` reste envoyé par le formulaire ; aucune nouvelle diffusion. La destination finale est `/links/[id]`, jamais l'URL publique retournée pour le partage.

## I–K. Parcours gouverné, absence de Workspace et provenance

Le formulaire manuel et l'assistant affichent le contexte fourni, ou « Ce parcours sera créé sans Workspace ». Le chargement de tous les Workspaces, les sélecteurs et la saisie d'un nom à réutiliser disparaissent de la création.

`createGovernedJourneyAction` ne crée, ne recherche par nom, n'upsert et ne réactive plus aucun Workspace. Un contexte explicite est recherché par ID, propriétaire et statut ACTIVE. Le RelationTemplate est créé avec cet ID ou null.

Dans la même transaction, la version 1 conserve `metadata.source = "governance-v1-minimal-create"` et `metadata.createdById` provenant du serveur. Les tests donnent cette preuve au vrai garde DEBT-AUTH-02 : READ et catalogue propriétaire autorisés au créateur A, refusés à B. L'ouverture continue d'utiliser **FormTemplate.id** dans `/gouvernance/parcours/[id]/pilotage`.

## L. Fonctions exigeant encore un Workspace

Les gardes d'invitation, d'accès et de communication ne sont pas élargies. Le panneau de création d'accès invité affiche une courte indisponibilité si le parcours n'a pas de Workspace. Les états de communication/consolidation sans Workspace déjà présents restent en place. Aucun rattachement ni accès automatique. Le rattachement manuel historique du cockpit n'est pas réimplémenté ou modifié.

## M. Sécurité

Les modules communs `relation-template-access.ts` et `template-mutation-access.ts` sont inchangés. Les 40 tests READ/USE et les 43 tests MUTATE A/B passent. Les nouveaux tests exécutent les vrais handlers avec persistance et session contrôlées : propriété de session, contrôle ACTIVE, refus avant écriture, absence de fallback et de mail, preuve initiale et lecture propriétaire. Les tests ne constituent pas une recette de base réelle ni un test de concurrence transactionnelle.

## N. Boussole

Procédure `docs/boussole-maintenance.md` suivie avant modification. Runtime inchangé, aucune donnée fictive, action métier ou navigation automatique déclenchée par « Montrer la zone ».

| Surface/état | Impact | Version |
| --- | --- | --- |
| Mes espaces EMPTY / POPULATED | Cibles de création sur les vrais liens du menu ; mécanisme de révélation existant conservé | Guides d'organisation inchangés |
| Formulaire gouverné, contexte global ou Workspace | L'étape de choix/nommage devient une lecture du contexte ; suppression des sous-cibles des sélecteurs retirés | `use-journey-assistant` et `create-manually` : 2 |
| Builder simple | Après création humaine, ouverture de la page propriétaire ; retrait de quatre étapes post-création du builder | `verify-create` : 2 |
| Lien propriétaire FOCUSED | Copie et ouverture publique disponibles dans son guide existant | Inchangée |
| Cockpit FOCUSED sans Workspace | Indisponibilité honnête des fonctions concernées ; aucune cible artificielle | Inchangée, étapes/cibles du guide cockpit conservées |

Les autres versions sont inchangées. Le guide simple compte désormais 36 étapes au lieu de 40 ; les identifiants restants sont conservés. Maintenance complète : 55/55.

## O. Responsive et accessibilité

`npm.cmd run qa:connected-navigation` réussi dans Chrome aux largeurs **320, 375, 768, 1024, 1440**. Vrais composants React et CSS Tailwind ; transport Next et données simulés en mémoire. Menus Mes espaces et Workspace, présence des destinations, focus visible, Tab, Enter, Escape avec restitution du focus, fermeture extérieure, historique, Portfolio et shell contrôlés. Aucun débordement horizontal mesuré. Captures locales mobile/desktop disponibles dans le dossier temporaire du harnais, hors Git.

La validation navigateur couvre les points d'entrée et la navigation, pas une création de bout en bout sur une base réelle. Les créations et refus serveur sont couverts par les tests de handlers ; la recette humaine des trois objets et de la branche IA avec services réels reste à effectuer.

## P–T. Contrôles

| Contrôle | Résultat |
| --- | --- |
| `qa/object-creation.test.ts` | 30/30 : matrice 3 objets × 6 contextes, archivage entre lecture/soumission, contexte JSON/FormData malformé, quatre frontières assistées, classification, choix manuel/assisté, sélection template explicite, requête et redirection du vrai formulaire final |
| Ensemble fonctionnel/non-régression détaillé ci-dessous | 363/363, dont READ/USE 40 et MUTATE 43 |
| `npm.cmd run qa:boussole-maintenance` | 55/55 |
| `npm.cmd run typecheck` | Succès, zéro diagnostic |
| `npm.cmd run build` | Succès complet, 61/61 pages, code sortie 0 |
| Chrome | Cinq largeurs réussies ; lancement hors sandbox nécessaire |
| D-020, deux suites historiques | 8 réussis / 2 échecs conservés |
| Contrôle élargi `qa/product-object-clarity.test.ts` | 7 réussis / 1 échec historique KPI, documenté et non corrigé |
| UTF-8 / `git diff --check` | Contrôles finaux sur tous les fichiers du lot |

Build : avertissements de cache webpack « Unable to snapshot resolve dependencies », sans échec de compilation, de typage ou de génération. La dette FormData.get n'est ni réintroduite ni corrigée dans ce lot.

Commande de non-régression exécutée :

```powershell
node --experimental-strip-types --test qa/object-creation.test.ts qa/relation-template-access.test.ts qa/template-mutation-access.test.ts qa/candidate-form-safety.test.ts qa/announcement-publication.test.ts qa/manual-journey-editor.test.ts qa/opportunity-domain.test.ts qa/workspace-detail.test.ts qa/workspace-creation.test.ts qa/workspace-portfolio-creation.test.ts qa/workspace-pilotage.test.ts qa/spaces.test.ts qa/portfolio-explorer.test.ts qa/dashboard-home.test.ts qa/dashboard-glink-polish.test.ts qa/connected-shell.test.ts qa/spatial-navigation.test.ts qa/governed-invitation-access.test.ts qa/feedback-url.test.ts qa/document-upload.test.ts qa/web-typecheck.test.ts qa/simple-link-builder.test.ts qa/opportunity-preview.test.ts qa/secure-link-preview.test.ts
```

Contrôles historiques conservés, exécutés séparément et non masqués :

```powershell
node --experimental-strip-types --test qa/announcement-archive.test.ts qa/archived-opportunity-count.test.ts
node --experimental-strip-types --test qa/product-object-clarity.test.ts
```

## U. Diff et coûts

🟢 **Réemploi** : builders, modèles Prisma, preuve initiale/génération validée, gardes READ/USE/MUTATE, menus natifs, filtres propriétaires existants. Aucun formulaire dupliqué dans Mes espaces.

🟡 **Adaptation** : menus, routes de création et composants intermédiaires, contexte serveur des API assistées et du GLink, parcours gouverné sans Workspace, état d'accès indisponible, libellés dans les projections, guides/version Boussole, assertions devenues obsolètes et harnais Chrome. Une lecture Workspace ciblée supplémentaire à chaque frontière contextualisée ; aucune lecture supplémentaire du Workspace en création globale. Suppression du chargement global des Workspaces dans le formulaire gouverné. Lecture du JSON `rules` avec les lignes Workspace existantes, sans N+1.

🟠 **Nouveau** : helper applicatif compact `lib/object-creation.ts`, marqueur des nouvelles Opportunités, matrice `qa/object-creation.test.ts` et ce rapport.

🔴 **Refonte** : aucune. Aucun changement Prisma/migration, modèle Opportunity, runtime Boussole, catalogue global reconstruit, pagination ou nouvelle fonction d'organisation.

## V. Registre des dettes

Note ajoutée à `docs/debt-register.md`. D-002/D-004/D-015/D-019/D-020 restent OPEN. Le retrait de l'upsert gouverné est explicitement requis par ce lot, sans clôture de D-004 ni correction de l'historique. Le repli UI du template explicitement demandé est corrigé uniquement dans le flux de création concerné. L'assertion KPI supplémentaire rejoint le suivi QA de D-020, sans masquer les deux échecs déjà connus.

## W–Y. État Git, réserves et recommandation

Les fichiers UX-01E.1 restent non commités. `m1a/` demeure non suivi, exclu et non modifié. Aucun fichier de capture, log ou temporaire dans le lot. Aucun push, tag ou autre chantier.

Réserves : les templates historiques sans provenance ne deviennent pas personnels/partagés ; le flux de duplication historique sans destination conserve 409 ; les fonctions exigeant un Workspace restent limitées ; la classification de GLinks historiques inconnus reste « Lien » ; la recette avec compte, base et services IA réels n'est pas remplacée par le harnais local. Recommandation : revue humaine du diff et des six créations avant tout jalon de commit.

## Matrices finales

| Objet | Création globale | Création Workspace | Modèle réel | workspaceId | Preuve propriétaire | Destination après création | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lien simple | Oui | Oui | GLink + supports techniques | null / A direct | GLink.ownerId | `/links/[id]` | Matrice + Workspace + builder |
| Opportunité | Oui | Oui | GLink ; template intermédiaire du flux assisté | null / A direct sur GLink | GLink.ownerId ; USE séparé | `/templates/[formId]` intermédiaire, puis `/links/[id]` | Matrice + formulaire + AUTH-02 |
| Parcours gouverné | Oui | Oui | RelationTemplate + FormTemplate + version 1 | null / A direct | Source fiable + createdById serveur ; Workspace propriétaire si présent | `/gouvernance/parcours/[formId]/pilotage` | Matrice + provenance READ A/B |

| Contexte | Lien simple | Opportunité | Parcours |
| --- | --- | --- | --- |
| Mes espaces | Créé sans Workspace | Créée sans Workspace | Créé sans Workspace |
| Workspace propriétaire actif | Créé directement dans A | Créée directement dans A | Créé directement dans A |
| Workspace étranger | Refus | Refus | Refus |
| Workspace archivé | Refus | Refus | Refus |
| workspaceId invalide | Refus sans fallback | Refus sans fallback | Refus sans fallback |

## Inventaire des fichiers pour la revue

- `app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant.tsx`
- `app/(connected)/gouvernance/nouveau/page.tsx`
- `app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx`
- `app/(connected)/links/new/NewLinkForm.tsx`
- `app/(connected)/links/new/page.tsx`
- `app/(connected)/links/simple/simple-link-builder.tsx`
- `app/(connected)/opportunities/new/page.tsx`
- `app/(connected)/templates/[templateId]/page.tsx`
- `app/api/gouvernance/journey-ai-generate/route.ts`
- `app/api/links/route.ts`
- `app/api/templates/ai-generate/[generationId]/revise/route.ts`
- `app/api/templates/ai-generate/[generationId]/validate/route.ts`
- `app/api/templates/ai-generate/route.ts`
- `components/AITemplateDesigner.tsx`
- `components/OpportunityPreviewActions.tsx`
- `components/OpportunityPreviewCard.tsx`
- `components/SpacesCreateActions.tsx`
- `components/SpacesExistingAttachments.tsx`
- `components/WorkspaceCreateActions.tsx`
- `components/WorkspaceDetailView.tsx`
- `docs/debt-register.md`
- `docs/ux-01e1-objets-creations.md`
- `lib/boussole-context.ts`
- `lib/boussole-new-governed-journey.ts`
- `lib/boussole-simple-link.ts`
- `lib/boussole/registry.ts`
- `lib/governance-journey-actions.ts`
- `lib/governance-workspace-repository.ts`
- `lib/object-creation.ts`
- `lib/workspace-detail-repository.ts`
- `qa/announcement-publication.test.ts`
- `qa/contextual-boussole.test.ts`
- `qa/new-governed-journey-boussole.test.ts`
- `qa/object-creation.test.ts`
- `qa/relation-template-access.test.ts`
- `qa/simple-link-builder.test.ts`
- `qa/spaces.test.ts`
- `qa/workspace-creation.test.ts`
- `qa/workspace-detail.test.ts`
- `qa/workspace-portfolio-creation.test.ts`
- `scripts/qa-connected-navigation.mjs`
