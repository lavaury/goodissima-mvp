# Goodissima - Staging Release Candidate

Date de préparation : 17 juin 2026  
Référence : `RELEASE-STAGING-01`  
Statut : **candidat staging conditionnel - ne pas déployer sans validation des prérequis**

## Features

- Ajout du moteur d'intentions Goodissima embarqué :
  - CIRO, résolution d'intention, corpus, benchmarks et gouvernance.
  - Évaluation déterministe des merges logement et emploi.
  - Jeux de connaissances et démonstrations françaises.
- Nouveau parcours produit centré sur les objets métier :
  - Opportunités, parcours, annonces, demandes de relation et relations.
  - Routes `/opportunities`, `/parcours`, `/relations` et `/experience`.
  - Prévisualisations et visuels par catégorie d'opportunité.
- Extension du cycle de vie des parcours :
  - génération assistée par IA ;
  - révisions conversationnelles versionnées ;
  - édition manuelle auditée ;
  - analyse Template Critic ;
  - propositions Template Optimizer et approbation humaine ;
  - garde de sécurité avant publication.
- Workspace relationnel enrichi :
  - situation du dossier ;
  - chronologie et événements humanisés ;
  - actions relationnelles ;
  - dictée vocale optionnelle ;
  - matching et merge gouvernés ;
  - contrôles d'identité, confiance et accès candidat.
- Observabilité IA :
  - tokens, latence et coûts estimés ;
  - valeur estimée par fonctionnalité et parcours ;
  - tableaux de bord `/ia-valeur` et `/admin/ai-costs` ;
  - export CSV.
- Administration du feedback produit :
  - stockage Prisma ;
  - recherche et filtres ;
  - statut, notes administrateur et export CSV ;
  - accès limité à `ADMIN`, `SUPER_ADMIN` et `PRODUCT_OWNER`.
- Captures d'écran de feedback :
  - PNG, JPG et WEBP ;
  - cinq fichiers maximum, 10 Mo par fichier ;
  - stockage privé Supabase ;
  - miniatures, agrandissement et téléchargement administrateur ;
  - métadonnées prêtes pour de futures annotations.

## UX improvements

- La route `/` devient une entrée de connexion minimale et professionnelle.
- `/login` et `/` utilisent le même formulaire et le même flux Supabase.
- Les contenus de découverte restent disponibles sous `/experience` et `/demo`.
- Navigation principale réorganisée autour de Dashboard, Opportunités, Parcours, Relations, IA & Valeur et Administration.
- Vocabulaire français clarifié entre parcours, annonce, lien sécurisé et relation.
- Affichage des réponses candidat avec libellés métier plutôt que données techniques brutes.
- Dictée vocale explicitement déclenchée par l'utilisateur, sans envoi automatique.
- Feedback avec choix explicite de joindre la page actuelle et/ou des captures.
- Responsive mobile-first renforcé sur la connexion, les opportunités et les workspaces.

## Bug fixes

- Garde de publication unifiée pour empêcher les formulaires candidat non sûrs.
- Correction des champs obligatoires masqués, identifiants dupliqués et mappings système incompatibles.
- Historique et événements relationnels humanisés ; codes bruts réservés au diagnostic propriétaire.
- Préservation des réponses brutes tout en produisant un résumé lisible dans la conversation.
- Correction de la cohérence des versions publiées et invalidation des caches concernés.
- Correction des tests QA devenus obsolètes après la page d'accueil authentication-first et le nouveau garde de publication.
- Nettoyage du démarrage local Next lorsqu'un cache `.next` ou plusieurs serveurs concurrents bloquent le lancement.

## Technical inventory

### Schema changes

- `AIEvent` :
  - tokens d'entrée/sortie et prompt/completion ;
  - coût estimé ;
  - latence ;
  - utilisateur, organisation, fonctionnalité et parcours associés.
- Nouveaux modèles :
  - `TemplateGeneration`
  - `TemplateCriticReport`
  - `TemplateOptimization`
  - `ManualTemplateEditAudit`
  - `ProductFeedback`
  - `ProductFeedbackAttachment`
- `TemplateGeneration` prend en charge :
  - événement IA ;
  - génération parente ;
  - version de proposition ;
  - feedback de révision ;
  - changements structurés.
- Nouvel enum `ProductFeedbackStatus` :
  - `NEW`
  - `IN_PROGRESS`
  - `RESOLVED`
  - `IGNORED`

## Database migrations

Le release candidate contient neuf migrations nouvelles par rapport à `HEAD` :

1. `20260613090000_add_ai_event_audit_metrics`
2. `20260614170000_add_ai_template_designer`
3. `20260614190000_add_template_critic_reports`
4. `20260614200000_add_template_optimizations`
5. `20260614210000_add_ai_cost_observability`
6. `20260615150000_add_conversational_opportunity_refinement`
7. `20260615170000_add_manual_journey_edit_audit`
8. `20260617173000_add_product_feedback`
9. `20260617183000_add_product_feedback_attachments`

État de la base configurée lors de la préparation :

- 38 migrations détectées.
- Trois migrations non appliquées :
  - `20260615170000_add_manual_journey_edit_audit`
  - `20260617173000_add_product_feedback`
  - `20260617183000_add_product_feedback_attachments`
- Aucune migration n'a été appliquée pendant cette préparation.

### New pages

- `/admin/ai-costs`
- `/administration`
- `/administration/feedback`
- `/demo/housing-candidates`
- `/experience`
- `/ia-valeur`
- `/opportunities`
- `/opportunities/new`
- `/parcours`
- `/relations`
- `/templates/demo`

### New API routes

- `/api/admin/ai-costs/export`
- `/api/admin/feedback/[feedbackId]`
- `/api/admin/feedback/attachments/[attachmentId]/file`
- `/api/admin/feedback/export`
- `/api/cases/[caseId]/merge-opportunities`
- `/api/links/[linkId]`
- `/api/templates/[templateId]`
- `/api/templates/[templateId]/critic`
- `/api/templates/[templateId]/critic/[reportId]/optimize`
- `/api/templates/[templateId]/lifecycle`
- `/api/templates/[templateId]/manual-versions`
- `/api/templates/[templateId]/optimizations/[optimizationId]/approve`
- `/api/templates/ai-generate`
- `/api/templates/ai-generate/[generationId]/revise`
- `/api/templates/ai-generate/[generationId]/validate`

### Environment variables

Nouvelles références par rapport à `HEAD` :

- `DIRECT_URL` : requise par Prisma pour les connexions directes/migrations.
- `SUPABASE_URL` : utilisée par le seed de développement ; optionnelle pour le runtime principal.

Variables existantes désormais critiques pour les captures feedback :

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- bucket privé Supabase `case-documents`

Les exemples staging documentent déjà `DIRECT_URL`, `SUPABASE_URL` et la clé service role. Le `.env` local utilisé pendant la préparation ne contenait pas `DIRECT_URL`; les validations ont utilisé temporairement `DATABASE_URL` comme valeur directe.

### Dependencies

- Aucune nouvelle dépendance externe dans le package racine.
- Nouveau package interne `goodissima-intent-engine`.
- Ses seules dépendances de développement sont `typescript` et `@types/node`, déjà utilisées par le dépôt principal.
- Le script `build` compile désormais le moteur d'intentions avant Prisma et Next.

## Verification results

- `npm run build` : **PASS**
  - compilation du moteur d'intentions ;
  - génération Prisma ;
  - build Next production ;
  - 47 pages générées.
  - avertissements non bloquants de cache Webpack.
- `npx tsc --noEmit` : **PASS**
- `npx prisma validate` : **PASS** avec `DIRECT_URL` défini.
- `npx prisma migrate status` : **PASS pour l'inspection**, trois migrations en attente.
- Moteur d'intentions : **60/60 PASS**
- Tests applicatifs racine : **174/174 PASS**
- Tests IA spécialisés : **27/27 PASS**
- Scénarios IA déterministes : **26/26 PASS**
- QA IA historique : **6/6 PASS**
- Matching : **PASS**, 200 profils déterministes.
- Matching V2 : **PASS**, 500 profils déterministes.
- Embeddings : **PASS**, y compris simulation 1000+ jobs.
- QA événements : **PASS**
- QA UI layout/polish/brand/premium : **PASS**
- `git diff --check` : **PASS**

Non exécutés :

- `qa:mistral` : nécessite un fournisseur distant et une clé réelle.
- `qa:matching:v2:real` : nécessite les services/données réels.
- tests end-to-end navigateur sur une URL staging déployée.
- application des migrations staging.

## Risks

### Release blockers before staging

- Vérifier que `DIRECT_URL` est configurée dans l'environnement staging/CI. Sans elle, Prisma CLI et le build échouent avant compilation.
- Appliquer les trois migrations en attente avant d'exposer les écrans qui utilisent leurs tables.
- Vérifier les politiques RLS et les privilèges des nouvelles tables :
  - `TemplateGeneration`
  - `TemplateCriticReport`
  - `TemplateOptimization`
  - `ManualTemplateEditAudit`
  - `ProductFeedback`
  - `ProductFeedbackAttachment`

Les migrations actuelles créent les tables mais n'activent pas explicitement RLS sur celles-ci. Les accès applicatifs sont majoritairement serveur, mais les privilèges Supabase doivent être confirmés avant staging.

### Operational risks

- Le worktree est volumineux : 163 entrées modifiées/non suivies au moment de l'audit. Une revue du diff indexé est obligatoire avant commit.
- Six migrations du release candidate sont déjà présentes dans la base configurée alors qu'elles sont encore non suivies par Git. Elles doivent impérativement être incluses dans le commit de release pour éviter une divergence d'historique.
- `tsconfig.tsbuildinfo` est un artefact généré modifié : ne pas l'inclure dans le commit.
- Les uploads feedback réutilisent `case-documents`. Vérifier la présence du bucket, sa confidentialité, ses limites et sa politique de rétention.
- Le POST feedback public accepte des visiteurs et des fichiers. Il n'existe pas encore de quota ou rate limiting applicatif.
- Un échec au milieu d'un upload multiple peut laisser un feedback ou un objet storage partiellement créé.
- Les coûts IA restent estimatifs et non comptables.
- Les fonctionnalités voix dépendent des API navigateur et doivent être testées sur Chrome/Edge mobile et desktop.
- Les tables et colonnes ajoutées sont additives, mais Prisma ne fournit pas de migration descendante automatique.
- Le build affiche des avertissements de cache Webpack ; ils n'empêchent pas la compilation mais doivent être surveillés en CI.

## Manual test checklist

### Authentication and public entry

- [ ] Ouvrir `/` en navigation privée : logo, Connexion, email, mot de passe et liens d'accès uniquement.
- [ ] Vérifier l'absence de CTA dashboard, opportunité, IA ou matching sur `/`.
- [ ] Tester une connexion valide et la redirection vers `/dashboard`.
- [ ] Tester un email non invité lorsque `PRIVATE_ACCESS_MODE=true`.
- [ ] Tester `/reset-password`, `/signup` et le callback de confirmation.
- [ ] Vérifier qu'un utilisateur non authentifié ouvrant `/dashboard` est redirigé une seule fois vers `/login?next=/dashboard`.

### Opportunities and journeys

- [ ] Créer une opportunité en mode manuel.
- [ ] Créer une opportunité assistée avec le provider mock.
- [ ] Réviser une proposition, revenir à une version précédente et valider explicitement.
- [ ] Modifier manuellement un parcours et vérifier la création d'une version DRAFT auditée.
- [ ] Lancer Critic, générer une optimisation et l'approuver.
- [ ] Vérifier qu'une publication dangereuse est bloquée par le garde formulaire candidat.
- [ ] Publier un parcours sûr et vérifier l'annonce et le lien sécurisé.

### Candidate and relation workflows

- [ ] Soumettre un formulaire candidat depuis un lien public.
- [ ] Vérifier les réponses humanisées dans la conversation.
- [ ] Ajouter un message et un document.
- [ ] Tester expiration, révocation et régénération de l'accès candidat.
- [ ] Vérifier les statuts de gouvernance et les blocages d'écriture.
- [ ] Tester dictée vocale, annulation et absence d'envoi automatique.
- [ ] Tester matching opt-in et merge sans score sensible visible.

### AI and value

- [ ] Vérifier Résumé IA, Timeline IA, Signaux IA, Matching et Brouillons IA.
- [ ] Confirmer qu'aucune action IA n'est envoyée ou appliquée automatiquement.
- [ ] Vérifier la création des `AIEvent` avec tokens, coût et latence.
- [ ] Ouvrir `/ia-valeur` avec un rôle autorisé.
- [ ] Tester l'export CSV coûts/valeur.

### Feedback

- [ ] Envoyer un feedback sans capture.
- [ ] Envoyer un feedback avec page actuelle décochée.
- [ ] Envoyer cinq captures PNG/JPG/WEBP de moins de 10 Mo.
- [ ] Vérifier le rejet du sixième fichier, d'un format non autorisé et d'un fichier supérieur à 10 Mo.
- [ ] Vérifier les objets sous `feedback/{feedbackId}/` dans le bucket privé.
- [ ] Ouvrir `/administration/feedback` en `ADMIN`, `SUPER_ADMIN` et `PRODUCT_OWNER`.
- [ ] Vérifier le refus d'accès pour un rôle normal.
- [ ] Filtrer, rechercher, changer le statut et ajouter des notes.
- [ ] Agrandir et télécharger une capture.
- [ ] Exporter le CSV et vérifier le nombre de pièces jointes.

### Cross-browser and responsive

- [ ] Chrome desktop et mobile.
- [ ] Edge desktop.
- [ ] Safari/iOS pour les parcours sans dictée si l'API n'est pas disponible.
- [ ] Vérifier les vues 360 px, tablette et desktop large.

## Deployment checklist

### Git preparation

```bash
git status --short
git switch -c release/staging-2026-06-17

git add app components config docs goodissima-intent-engine lib locales prisma public qa scripts
git add package.json package-lock.json tsconfig.json RELEASE_NOTES_STAGING.md

git restore --staged tsconfig.tsbuildinfo
git diff --cached --check
git diff --cached --stat
git diff --cached

git commit -m "Prepare staging release candidate"
git tag -a staging-2026-06-17-rc1 -m "Goodissima staging RC1"
```

Ne pas ajouter :

- `.next/`
- `dist/`
- `node_modules/`
- fichiers `.log`
- `.feedback/`
- `tsconfig.tsbuildinfo`
- fichiers `.env*` contenant des secrets

### Pre-migration

```bash
npm ci
npm --prefix goodissima-intent-engine ci

npx dotenv -e .env.staging -- prisma validate
npx dotenv -e .env.staging -- prisma migrate status
npx dotenv -e .env.staging -- npm run build
```

- [ ] Confirmer que `DATABASE_URL` et `DIRECT_URL` pointent vers staging.
- [ ] Confirmer que `GOODISSIMA_ENV=staging`.
- [ ] Confirmer que `AI_PROVIDER=mock` et `AI_TEST_MODE=scenario`.
- [ ] Confirmer la configuration Supabase auth et les URLs de callback staging.
- [ ] Confirmer le bucket privé `case-documents`.
- [ ] Effectuer un snapshot/backup PostgreSQL avant migration.
- [ ] Vérifier ou ajouter les politiques RLS des nouvelles tables.

### Migration

Commande à exécuter uniquement après approbation de déploiement :

```bash
npx dotenv -e .env.staging -- prisma migrate deploy
npx dotenv -e .env.staging -- prisma migrate status
```

### Post-deployment validation

- [ ] Vérifier `/`, `/login`, `/dashboard` et les redirections.
- [ ] Vérifier les pages Opportunités, Parcours, Relations et Administration.
- [ ] Créer un feedback et confirmer sa présence en base.
- [ ] Tester une capture et son URL signée administrateur.
- [ ] Vérifier qu'un utilisateur normal ne peut ni lister ni télécharger les feedbacks.
- [ ] Vérifier une génération IA mock et un `AIEvent`.
- [ ] Tester publication d'un parcours et création d'un lien sécurisé.
- [ ] Vérifier les logs applicatifs et erreurs Supabase/Prisma pendant 30 minutes.
- [ ] Vérifier que les coûts, tokens et latences ne contiennent aucune donnée sensible.

## Rollback plan

### Preferred rollback: application only

Les migrations sont additives. Le rollback recommandé consiste à restaurer l'application précédente tout en laissant les nouvelles tables/colonnes en place.

```bash
git switch <branche-de-deploiement>
git revert <commit-du-release-candidate>
git push
```

Ou redéployer directement le dernier artefact/tag validé :

```bash
git checkout <dernier-tag-staging-stable>
npm ci
npm run build
```

Après rollback applicatif :

- vérifier `/`, `/login`, `/dashboard` ;
- vérifier les anciennes routes principales ;
- laisser les tables additives inutilisées ;
- conserver les données de feedback et d'audit pour investigation.

### Database rollback: only if strictly required

Prisma ne génère pas de migrations descendantes. Ne pas supprimer automatiquement les nouvelles structures.

1. Mettre staging en maintenance.
2. Exporter les données des nouvelles tables.
3. Sauvegarder la base complète.
4. Redéployer l'application précédente.
5. Évaluer une migration SQL inverse revue manuellement, dans l'ordre de dépendance inverse :
   - `ProductFeedbackAttachment`
   - `ProductFeedback` et `ProductFeedbackStatus`
   - `ManualTemplateEditAudit`
   - colonnes de révision de `TemplateGeneration`
   - relations/coûts ajoutés à `AIEvent` et `TemplateGeneration`
   - `TemplateOptimization`
   - `TemplateCriticReport`
   - `TemplateGeneration`
   - métriques d'audit IA
6. Ne marquer une migration comme rolled back avec Prisma qu'après rollback SQL réellement exécuté et vérifié.

Les fichiers Supabase sous `feedback/` ne sont pas supprimés automatiquement par un rollback base. Les conserver pendant l'investigation ou les supprimer séparément après validation.

### Rollback validation

- [ ] `prisma migrate status` cohérent avec l'état attendu.
- [ ] Application précédente fonctionnelle.
- [ ] Aucun endpoint nouveau encore exposé par l'artefact actif.
- [ ] Données historiques exportées et accessibles.
- [ ] Aucun objet storage orphelin supprimé sans validation.
