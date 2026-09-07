# DEBT-TS-01 — Assainissement du projet web

Validation technique du 2026-09-07 sur baseline `9ea80e9bb5c79e989b409d1dbe679dae926360fb`, sans commit/push.

## Cause et mesure

Commande de reproduction avant modification :

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

TypeScript installé/verrouillé : **5.9.3** (`package.json` conserve `^5.6.3`). Node : **v24.14.1**.
Le chiffre historique « environ 668 » n'est pas utilisé comme baseline exacte : le contrôle reproduit donne **696 diagnostics uniques dans 125 fichiers**.

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Entrées racines tsconfig | 1 599 | 711 |
| Diagnostics | 696 | 0 |
| Fichiers portant un diagnostic | 125 | 0 |
| Entrées m1a | 808 | 0 |
| Diagnostics m1a | 686 | 0 (hors projet web) |
| Diagnostics produit principal | 8 | 0 |
| Diagnostics QA principaux | 2 | 0 |

L'inventaire complet est conservé dans [debt-ts-01-inputs.json](debt-ts-01-inputs.json), avec entrées avant/après, retraits et ajouts.
Il distingue les **racines** sélectionnées par tsconfig des fichiers du **programme**, qui incluent les dépendances et déclarations importées.
Le nombre de fichiers `.next/types` dépend de la génération Next ; les chiffres ci-dessus sont ceux de cette validation, pas un seuil à figer en CI.

Les 890 racines retirées se décomposent exactement en 808 fichiers m1a et 82 déclarations générées `goodissima-intent-engine/dist`.
Les 709 racines web préexistantes sont conservées ; deux nouveaux fichiers QA donnent 711 entrées finales.
Les sources et tests du moteur restent contrôlés (69 + 12). Ses déclarations générées réellement importées sont toujours résolues par TypeScript : elles ne sont simplement plus toutes ajoutées comme racines.

## Configuration

Les globs globaux `**/*.ts` et `**/*.tsx` sont remplacés par des entrées explicites pour les répertoires web : app, components, lib, config, emails, qa, scripts, sources/tests du moteur, fichiers TS racine et `.next/types`.
`next-env.d.ts`, middleware et configuration Tailwind restent inclus. Aucun QA utile ou script TS existant n'est retiré.
Les copies voisines, projets mobiles et artefacts ne deviennent plus implicitement des projets web parce qu'ils sont présents sur le disque.

Exclusions explicites : node_modules (déclarations importées toujours résolues), m1a (copie locale), goodissima-mobile (projet distinct), .worktrees (checkouts), dist/build (sorties générées).
La liste positive des racines empêche aussi une nouvelle copie à la racine, sous un autre nom, d'entrer via un glob global.
Une exclusion ne bloque pas un **import explicite** : le test `qa/web-typecheck.test.ts` inspecte également les sources transitives pour m1a/mobile/React Native/.worktrees. Tout nouveau répertoire de sources web doit être ajouté aux includes ; une copie imbriquée dans un répertoire inclus demeure à proscrire.

Toutes les options de compilation sont conservées : notamment `strict: true`, `noEmit: true`, `skipLibCheck: true` ; aucun `ignoreBuildErrors` ajouté.
`skipLibCheck` ne neutralisait pas les effets de globals React Native sur le code consommateur.

## Corrections des contrats

**D-001 :** `Request.formData()` était influencé par les déclarations de React Native sous m1a (append/getAll/getParts, sans get). Après isolation, les déclarations DOM, DOM iterable, React et Node web sont résolues, sans aucun fichier React Native dans le programme. Les trois erreurs upload et cinq erreurs feedback disparaissent sans changer ces routes.

**QA 1 :** `normalizePublicFormField<T>(field: T): T` promettait de conserver des types littéraux pourtant remplacés à l'exécution. Le retour décrit désormais trois possibilités : type normalisé avec options conservées, SELECT avec options normalisées, TEXT de repli avec options vides et placeholder remplacé. Les autres métadonnées génériques sont conservées. Le cast de sortie est retiré. Les tests rétrécissent les options avec `Array.isArray` ; une assertion de compilation vérifie qu'on ne peut plus attribuer la sortie au sous-type d'entrée. Aucun changement runtime.

**QA 2 :** le repository mémoire matching déclare explicitement `transaction<T>(...): Promise<T>`, conformément au contrat produit. Aucun `any` ajouté, aucun changement runtime.

## Commande officielle et CI

```sh
npm run typecheck
# tsc --noEmit --project tsconfig.json --incremental false
```

Résultat requis : **0 diagnostic et code de sortie 0**. Une erreur nouvelle provoque un code non nul ; il n'y a ni budget d'erreurs ni baseline autorisant des diagnostics résiduels.
Le contrôle désactive le cache incrémental pour une mesure reproductible et pour ne pas modifier le `tsconfig.tsbuildinfo` historiquement suivi.
Le build Next continue d'utiliser son mécanisme habituel, sans second système de build.
Pour obtenir la liste courante des racines : `node node_modules/typescript/bin/tsc --showConfig` (champ files). Pour les fichiers transitifs : `node node_modules/typescript/bin/tsc --listFilesOnly --incremental false`.

Aucune configuration CI versionnée n'a été trouvée dans le dépôt principal. Aucun système CI créé.
Lors du raccordement CI : installer depuis le lockfile, générer Prisma et construire le moteur selon les prérequis existants du build, exécuter `npm run typecheck`, puis les tests. Toute erreur doit bloquer la CI. Ajouter aussi le test de frontière web ; conserver les inventaires historiques comme preuve, sans figer le nombre de fichiers.
Next peut compiler via SWC avant son contrôle de types ; son contrôle écarte notamment certains fichiers de tests. Le succès du build seul ne remplace donc pas le typecheck global du web, qui conserve les QA.

## Validation exécutée

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` | Succès, zéro diagnostic, y compris QA |
| `npm run build` | Succès complet : moteur, Prisma Client, Next, typage, génération 61/61 pages |
| 18 suites ciblées ci-dessous | 212/212 |
| `qa/document-upload.test.ts` | 4/4, handler réel avec dépendances doublées, multipart natif, owner/candidat, refus sans fichier ou sans accès |
| `qa/web-typecheck.test.ts` | 2/2, frontière transitive et contrat FormData |
| `npm run qa:boussole-maintenance` | 55/55 |
| `npm --prefix goodissima-intent-engine test` | Build moteur et 60/60 |
| `npm run qa:template-draft-quality` | Compilation TS dédiée et 4/4 |
| Contrôle séparé D-020 | 8/10, deux échecs historiques conservés |
| UTF-8 et `git diff --check` | Conformes |

Commande des 212 tests :

```sh
node --experimental-strip-types --test qa/candidate-form-safety.test.ts qa/matching-lifecycle.test.ts qa/product-feedback.test.ts qa/feedback-url.test.ts qa/spaces.test.ts qa/portfolio-explorer.test.ts qa/workspace-portfolio-creation.test.ts qa/workspace-creation.test.ts qa/workspace-detail.test.ts qa/workspace-pilotage.test.ts qa/dashboard-home.test.ts qa/dashboard-glink-polish.test.ts qa/dashboard-link-counts.test.ts qa/connected-shell.test.ts qa/spatial-navigation.test.ts qa/navigation-disclosure.test.ts qa/boussole-navigation-integration.test.ts qa/portfolios-boussole.test.ts
```

Contrôle séparé de la dette QA connue :

```sh
node --experimental-strip-types --test qa/announcement-archive.test.ts qa/archived-opportunity-count.test.ts
```

Les deux assertions encore rouges réclament l'ancien compteur d'archives sur Dashboard, retiré par UX-01D.1. Elles restent inchangées et recensées sous D-020. Ce résultat ne constitue pas une validation de toute la QA du dépôt.
Le build signale des avertissements de cache webpack (`Unable to snapshot resolve dependencies`) sans échec ; les tests Node signalent le module type implicite déjà existant. Aucune correction opportuniste.
Les tests upload n'effectuent aucun accès Supabase, écriture en base ou envoi de mail réel ; la recette des services externes reste distincte.

## Périmètre final et réserves

Changements : tsconfig, script npm typecheck, contrat de normalisation, deux QA concernés, deux suites de régression et trois documents (rapport, inventaire, registre).
Aucune modification des API upload/feedback, Prisma, IA, autorisations, Workspace/Portfolio ou Boussole. Aucun objet métier créé pour les tests.
Le cache suivi `tsconfig.tsbuildinfo` produit par le build est restauré à son contenu baseline ; m1a reste non suivi et intact. Logs de contrôle dans le répertoire temporaire local, pas dans le diff.
337 tests de contrôle réussis ; séparément, 8 réussis et 2 échecs historiques D-020.
Registre : [D-001 à D-020](debt-register.md). D-001/D-017 validées techniquement dans le working tree ; commit de résolution non créé, recette humaine attendue. Les autres dettes restent ouvertes ou reportées.

Verdict : **prêt avec réserves** (D-020 connu, validation humaine et publication non effectuées). Aucun commit, push, DEBT-AUTH-01 ou UX-02 dans cette intervention.
