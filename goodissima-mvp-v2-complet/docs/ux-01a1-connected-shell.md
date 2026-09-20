# UX-01A.1 — ConnectedShell minimal

## A. Résumé exécutif

Les 34 pages propriétaires partagent un seul ConnectedShell. Les 12 pages publiques, d’authentification, invitées, candidates ou expérimentales explicitement exclues restent hors du groupe. Les 84 Route Handlers, dont le callback d’authentification, restent à leur emplacement. Aucune URL, règle métier ou migration n’est modifiée.

Validation : 539 tests QA réussis. Le build compile les modules puis échoue sur la dette TypeScript connue de l’upload de documents. La recette humaine avec de vraies sessions et données reste à effectuer. Aucun commit ni déploiement.

## B. Architecture avant / après

Avant : layout racine transversal, ContextualBoussole à la racine et montages répétés de PlatformNavigation/LogoutButton dans les pages.

Après :

```text
app/layout.tsx
  I18nProvider + ToastProvider
  GlobalLanguageSwitcher + FeedbackButton
  ├── (connected)/layout.tsx
  │     requireCurrentUser → ConnectedShell
  │       logo /dashboard + langue + déconnexion
  │       PlatformNavigation + badge existant
  │       contenu de page : titre, actions, main et contrôles conservés
  │       ContextualBoussole
  ├── pages B / B* / C
  └── API et auth/callback
```

Le groupe App Router constitue la frontière. Aucun catalogue d’URL côté client ne décide de monter le shell. Les utilitaires transversaux qui adaptent leur présentation utilisent le segment de layout `(connected)` fourni par Next.js.

## C. Liste exacte des pages déplacées

Pour chaque ligne, `app/<chemin>/page.tsx` devient `app/(connected)/<chemin>/page.tsx`. L’URL reste identique.

| URL / chemin | Catégorie |
| --- | --- |
| `/admin/ai-costs` | A |
| `/administration` | A |
| `/administration/feedback` | A |
| `/analytics` | A |
| `/annuaire` | A |
| `/boussole` | A |
| `/boussole/decouverte` | A |
| `/cases` | A |
| `/cases/[caseId]` | A |
| `/dashboard` | A |
| `/experience` | A |
| `/gouvernance` | A |
| `/gouvernance/nouveau` | A |
| `/gouvernance/parcours/[id]/pilotage` | A |
| `/gouvernance/pilotage` | A |
| `/gouvernance/portfolios` | A |
| `/gouvernance/portfolios/[id]` | A |
| `/gouvernance/portfolios/[id]/pilotage` | A |
| `/gouvernance/portfolios/nouveau` | A |
| `/gouvernance/workspaces/nouveau` | A |
| `/ia-valeur` | A |
| `/identity` | A |
| `/links/[linkId]` | A |
| `/links/new` | A |
| `/links/simple` | A |
| `/opportunities` | A |
| `/opportunities/new` | A |
| `/parcours` | A |
| `/relations` | A |
| `/settings` | A |
| `/templates` | A |
| `/templates/[templateId]` | A |
| `/templates/demo` | A |
| `/trust/connectors` | A |

Huit fichiers compagnons sont déplacés avec leurs pages, sans changement de contenu :

```text
app/analytics/loading.tsx
app/dashboard/DashboardRealtimeRefresh.tsx
app/gouvernance/nouveau/GovernanceJourneyAssistant.tsx
app/gouvernance/nouveau/GovernedJourneyEducationalPreview.tsx
app/links/new/NewLinkForm.tsx
app/links/simple/simple-link-builder.tsx
app/settings/loading.tsx
app/settings/SettingsPanel.tsx
```

Leur destination insère également `(connected)/` après `app/`. Total : 42 déplacements.

## D. Exclusions explicites

Ces fichiers restent inchangés par rapport à l’état validé UX-01A.0 :

| URL | Fichier conservé |
| --- | --- |
| `/` | `app/page.tsx` |
| `/login` | `app/login/page.tsx` |
| `/signup` | `app/signup/page.tsx` |
| `/reset-password` | `app/reset-password/page.tsx` |
| `/update-password` | `app/update-password/page.tsx` |
| `/private-access` | `app/private-access/page.tsx` |
| `/secure/[token]` | `app/secure/[token]/page.tsx` |
| `/l/[slug]` | `app/l/[slug]/page.tsx` |
| `/l/[slug]/confirmation` | `app/l/[slug]/confirmation/page.tsx` |
| `/gouvernance/invitation/[token]` | `app/gouvernance/invitation/[token]/page.tsx` |
| `/demo/housing-candidates` | `app/demo/housing-candidates/page.tsx` |
| `/test-email` | `app/test-email/page.tsx` |
| `/auth/callback` | `app/auth/callback/route.ts` |

Les 83 handlers sous `app/api/` et l’icône restent également hors du shell. L’inventaire complet des URL attendues des pages et handlers est conservé dans `qa/fixtures/connected-routes.json`.

Une session propriétaire présente lors de la visite d’une page C ne change pas son ascendance de layouts : aucun ConnectedShell n’y est monté.

## E. Fichiers créés

```text
app/(connected)/layout.tsx
components/ConnectedShell.tsx
qa/connected-shell.test.ts
qa/fixtures/connected-routes.json
qa/helpers/render-connected-shell.ts
docs/ux-01a1-connected-shell.md
```

Les fichiers déplacés de C ne sont pas de nouvelles implémentations.

## F. Fichiers modifiés

En complément des déplacements :

| Fichier | Modification |
| --- | --- |
| `app/layout.tsx` | Retrait du montage racine de ContextualBoussole |
| `components/PlatformNavigation.tsx` | Montage central, lien actif dérivé du pathname, mêmes 16 destinations et IDs, contraintes de largeur du badge |
| `components/GlobalLanguageSwitcher.tsx` | Suppression du sélecteur flottant lorsque le shell fournit le même contrôle inline |
| `components/LogoutButton.tsx` | Option de présentation compacte pour le shell ; traitement de déconnexion inchangé |
| `components/ToastProvider.tsx` | Notifications avant le contenu, dans le flux sur A ; position fixe existante sur B/C |
| `package.json` | Ajout de `qa:connected-shell` |

Dans les pages déplacées : seuls les imports/montages locaux de PlatformNavigation et LogoutButton sont retirés, avec leurs enveloppes dédiées. Les chemins d’import des deux alias et de GovernanceJourneyAssistant sont adaptés. Les titres, actions, requêtes, autorisations et composants métier restent identiques.

Liste exacte des 32 tests existants adaptés aux chemins physiques, avec adaptation des assertions de montage dans les deux suites de navigation :

```text
qa/announcement-archive.test.ts
qa/announcement-publication.test.ts
qa/announcement-secure-link-actions.test.ts
qa/app-ux-integration.test.ts
qa/app-ux-vocabulary.test.ts
qa/archived-opportunity-count.test.ts
qa/boussole-navigation-integration.test.ts
qa/boussole-welcome-media.test.ts
qa/boussole-welcome-surface.test.ts
qa/candidate-form-safety.test.ts
qa/canonical-relation-case.test.ts
qa/champagne-workspace.test.ts
qa/contextual-boussole.test.ts
qa/dashboard-glink-polish.test.ts
qa/dashboard-link-counts.test.ts
qa/glink-matching.test.ts
qa/governance-attention-signals.test.ts
qa/governance-boussole.test.ts
qa/governance-review-human-conduct.test.ts
qa/governed-journey-cockpit-boussole.test.ts
qa/matching-ui-persistence.test.ts
qa/minimal-login-entry.test.ts
qa/new-governed-journey-boussole.test.ts
qa/opportunities-boussole.test.ts
qa/opportunity-domain.test.ts
qa/portfolios-boussole.test.ts
qa/product-feedback.test.ts
qa/product-object-clarity.test.ts
qa/public-app-url.test.ts
qa/release-v1-polish.test.ts
qa/secure-link-admission.test.ts
qa/simple-link-builder.test.ts
```

Les modifications UX-01A.0 déjà présentes dans le répertoire de travail sont conservées : middleware, feedback, nettoyage des URL et exclusion Boussole des invitations. Elles ne constituent pas de nouvelles modifications UX-01A.1. Le répertoire préexistant non suivi `m1a/` n’est pas modifié.

## G. Fonctionnement du shell et utilitaires

Une seule navigation principale et un seul shell. Le logo réutilise le fichier existant, avec un lien accessible « Goodissima — Accueil » vers `/dashboard`. Le cadre du logo limite la place prise par les marges transparentes de l’image. Le contenu conserve son propre repère `main`.

Le lien actif suit la route et ses descendants. `/parcours` et `/ia-valeur` restent des réexports de leurs implémentations existantes. Les routes secondaires conservent une destination parente dans la navigation. Annuaire et Boussole restent nommés explicitement. Aucune navigation UX-01A.2 n’est ajoutée.

| Utilitaire | Périmètre retenu |
| --- | --- |
| ContextualBoussole | Shell A uniquement, sous Suspense ; résolveur de contexte et exclusion UX-01A.0 conservés |
| I18nProvider | Racine transversale |
| GlobalLanguageSwitcher | Racine, rendu flottant conservé sur B/C ; le shell A utilise directement LanguageSwitcher une seule fois |
| FeedbackButton | Racine, logique d’accès et nettoyage des URL UX-01A.0 inchangés |
| ToastProvider | Racine ; sur A, les notifications occupent une place avant le shell pour ne pas recouvrir ses commandes ; sur B/C, placement existant conservé |

Le header reste dans le flux. La navigation défile horizontalement à l’intérieur de sa zone. Les commandes se replient si nécessaire ; le badge est tronqué et limité en largeur sur tablette/bureau. La déconnexion compacte préserve son libellé et son traitement.

## H. Authentification et session

Le layout appelle `requireCurrentUser()` pour obtenir la session Supabase nécessaire au badge et au rendu connecté. Cette fonction existante vérifie l’utilisateur avec `auth.getUser()` et redirige vers `/login` sans email authentifié.

Le layout n’appelle pas `getCurrentPrismaUser()` : aucun upsert de propriétaire, aucune préférence créée et aucune invitation acceptée par le shell. Les pages, actions, repositories et handlers conservent leurs contrôles et effets existants.

Le badge reprend le nom des métadonnées de session, avec repli « Organisation Goodissima » si absent ou égal à l’email. Ce libellé reste une information de présentation ; il ne représente pas une nouvelle résolution d’organisation ni une autorisation. La lecture de session supplémentaire n’introduit aucune politique métier.

Administration reste visible comme auparavant. Aucun `isAdmin` artificiel, masquage ou nouveau droit n’est introduit.

## I. Impact Boussole

La procédure `docs/boussole-maintenance.md` a été consultée. Les états EMPTY, POPULATED et FOCUSED conservent leurs conditions, données réelles et étapes.

Les IDs de navigation restent identiques. `dashboard-menu`, auparavant porté par l’enveloppe de la navigation dans Dashboard, est maintenant porté par la navigation réelle du shell, uniquement sur `/dashboard`. Aucun objet ni cible fictive n’est créé.

Aucune modification de `pageId`, `journeyId`, `stepId`, `targetId`, fallback, ordre fonctionnel ou `journeyVersion`. Le déplacement physique et le changement de montage ne changent pas le sens des étapes. Les contrats de progression restent compatibles.

Le montage unique persiste entre pages A ; ContextualBoussole conserve son suivi existant du pathname et du contexte. Les surfaces C restent structurellement exclues, y compris avec une session propriétaire.

## J. Tests et résultats

| Vérification | Résultat |
| --- | --- |
| Tous les `qa/*.test.ts` de premier niveau via Node `--experimental-strip-types --test` | **539 réussis, 0 échec** |
| Suite ConnectedShell incluse ci-dessus | **54 réussis** : inventaire, frontières, rendu serveur, navigation, alias, refus sans session, utilitaires |
| `npm.cmd run qa:ux-01a-hardening` | **33 réussis** |
| `npm.cmd run qa:boussole-maintenance` | **54 réussis**, toutes les sous-suites exécutées |
| Autres suites Boussole, navigation, authentification, candidat, gouvernance et feedback | Incluses dans les 539 tests réussis |
| Comparaison des fichiers à la capture avant UX-01A.1 | 42 déplacements vérifiés ; aucun changement métier après normalisation des seuls retraits et imports autorisés |
| Inventaire des routes avec le normaliseur App Router de Next.js | 46 pages, 84 handlers, aucune collision et aucune URL modifiée |
| Manifeste de compilation Next.js | 34 pages `(connected)` ; pages/handlers restants et entrées techniques `_not-found`/icône présents |
| `git diff --check` | Réussi |

Les tests de frontière combinent la topologie réelle des routes et le rendu serveur des composants existants, avec dépendances session/Next simulées. Ils ne constituent pas une recette HTTP complète avec Supabase et PostgreSQL.

Mesures Chrome headless du shell rendu avec son CSS Tailwind et le vrai logo, nom d’organisation volontairement long :

| Largeur | Débordement de document | Navigations | Hauteur du header |
| --- | --- | --- | --- |
| 320 px | 0 px | 1 | 189 px |
| 360 px | 0 px | 1 | 189 px |
| 390 px | 0 px | 1 | 189 px |
| 768 px | 0 px | 1 | 149 px |
| 1440 px | 0 px | 1 | 149 px |

Aucun chevauchement logo/sélecteur de langue mesuré. Les notifications visibles sont testées en rendu serveur pour leur placement avant le contenu ; les boutons flottants Feedback/Boussole conservent leur position. La hauteur mobile inclut la navigation et le badge ; la bande de marque et de commandes tient sur une ligne dès 320 px. Le header ne reste pas fixé pendant le défilement.

Limite : ces mesures isolées ne valident pas tous les tableaux métier, les panneaux Boussole ouverts/réduits ni les modales de feedback en combinaison. Leur recette humaine demeure nécessaire.

## K. Build et comparaison à la baseline

`npm.cmd run build` exécuté une fois. Compilation des modules réussie, puis arrêt sur l’erreur connue :

```text
app/api/documents/upload/route.ts:128:27
Property 'get' does not exist on type 'FormData'.
```

Cette dette n’est pas corrigée. `tsconfig.tsbuildinfo` est restauré après le build. Les derniers ajustements de présentation compacte et leurs tests ont ensuite été validés séparément ; aucun deuxième build global n’a été lancé.

Le contrôle global inclut actuellement la copie non suivie `m1a/` et les types générés `.next/`, ce qui pollue les diagnostics (668 à la capture initiale, 760 lors du contrôle intermédiaire avant régénération des anciens chemins). Ces totaux ne constituent pas un test fiable du seul produit déplacé.

Pour isoler l’effet du lot, un programme TypeScript utilisant les options du projet a comparé les sources applicatives/QA/scripts avant et après, en reconstituant les sources initiales en mémoire et en excluant dans les deux cas `m1a/` et `.next/`. Résultat : **2 diagnostics avant, 2 après, aucun ajouté**. Les deux dettes restantes de ce périmètre sont :

- `qa/candidate-form-safety.test.ts` : conversion de `null` vers `unknown[]` (TS2352) ;
- `qa/matching-lifecycle.test.ts` : type de retour récursif implicite (TS7023).

Le contrôle applicatif a également été relancé après l’option compacte de déconnexion, avec les mêmes deux diagnostics. Aucun diagnostic dans le shell, le layout, les imports déplacés ou les utilitaires modifiés. Les tests Node exécutent correctement ces suites malgré les dettes statiques préexistantes.

## L. Risques et dettes restantes

- Le build global reste bloqué par la dette connue ; le lot ne peut pas être présenté comme une version déployable validée de bout en bout.
- L’entrée Administration reste inconditionnelle, avec les contrôles serveur existants. Sa politique globale reste à traiter dans un autre lot.
- Le badge reste le libellé historique de présentation du propriétaire ; aucune sélection multi-organisation nouvelle.
- La validation humaine doit couvrir une session propriétaire, la visite des exclusions avec et sans session, les langues, la déconnexion, les notifications, Feedback et les états Boussole EMPTY/POPULATED/FOCUSED sur données réelles.
- Les chevauchements éventuels entre panneaux flottants Boussole/Feedback préexistants ne sont pas refondus. Les en-têtes métier et leurs badges locaux restent conservés.
- `m1a/` et les dettes TypeScript de tests restent hors périmètre.

Risque estimé : **intermédiaire**, principalement lié à l’étendue des déplacements et à la recette avec services réels restant à effectuer.

## M. Résumé du diff

42 déplacements (34 pages + 8 compagnons), 6 nouveaux fichiers, 6 fichiers de structure/composants/package adaptés et 32 tests existants adaptés. Les changements sont évalués par rapport à UX-01A.0, qui était déjà présent et non committé.

Aucune modification supplémentaire des API, du middleware, des règles métier, des pages exclues ou du schéma Prisma. Aucune migration, aucune URL renommée, aucun commit. UX-01A.2 n’est pas commencé.

UX-01A.1 :

- [ ] prêt
- [x] prêt avec réserves
- [ ] bloqué
