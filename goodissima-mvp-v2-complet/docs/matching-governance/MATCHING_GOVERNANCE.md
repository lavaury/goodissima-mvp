# Goodissima Matching Governance

## 1. Vision du matching Goodissima

Le matching Goodissima est un moteur relationnel responsable. Il aide a identifier des correspondances potentielles entre dossiers opt-in, sans transformer Goodissima en marketplace ouverte ni en systeme de decision automatique.

Le matching Goodissima fait trois choses :

- il suggere des correspondances potentielles ;
- il explique pourquoi une correspondance peut etre pertinente ;
- il contextualise les limites, clarifications et signaux de vigilance.

Il ne fait jamais :

- decision automatique ;
- contact automatique ;
- revelation automatique d'identite ;
- refus ou validation automatique ;
- scoring social ;
- ranking opaque presente comme verite.

## 2. Matching relationnel vs marketplace classique

Une marketplace classique cherche souvent a maximiser la mise en relation immediate entre offre et demande. Goodissima adopte une logique differente : le matching est relationnel, gouverne et controle par l'humain.

Dans Goodissima :

- les dossiers doivent etre explicitement opt-in ;
- les correspondances restent pseudonymisees ;
- l'utilisateur voit des raisons explicables, pas un score brut ;
- une proposition de relation ne contacte personne automatiquement ;
- les evenements sont audites.

Cette approche est adaptee a des contextes ou la confiance, la confidentialite et la supervision humaine sont critiques : immobilier, investissement, partenariats, recrutement ou relations bancaires.

## 3. Principes fondamentaux

Principes appliques dans l'architecture actuelle :

- opt-in uniquement ;
- privacy-first ;
- human-in-the-loop ;
- explainability-first ;
- aucun score visible ;
- aucun contact automatique ;
- aucune revelation automatique d'identite ;
- aucune discrimination ;
- auditabilite ;
- fallback deterministic mock pour QA et robustesse.

Le matching est une aide a la decision humaine, pas un moteur de decision.

## 4. Opt-in matching

Le champ `RelationCase.matchingEnabled` controle l'eligibilite d'un dossier au matching. Sa valeur par defaut est `false`.

Composant UI :

- `components/MatchingOptInPanel.tsx`

Route :

- `PATCH /api/cases/[caseId]/matching-opt-in`

Le panneau est affiche :

- cote proprietaire : "Activer le matching pour ce dossier" ;
- cote candidat : "Je souhaite etre considere pour des opportunites compatibles".

Un changement d'opt-in cree un evenement relationnel `MATCHING_OPT_IN_CHANGED` et declenche un job d'embedding `manual_refresh`.

## 5. Pseudonymisation

Les resultats de matching sont affiches sous forme pseudonymisee dans `components/MatchingPanel.tsx`.

Le moteur retourne des libelles comme :

- `Relation compatible 1`
- `Relation compatible 2`

L'UI n'affiche pas automatiquement :

- nom du candidat ;
- email ;
- token ;
- lien secure ;
- identite complete du dossier cible.

La proposition relationnelle conserve aussi cette logique : elle cree une suggestion, pas une mise en relation automatique.

## 6. Human-in-the-loop

Le bouton `Proposer une relation` appelle :

- `POST /api/cases/[caseId]/matching-proposals`

Cette route cree :

- `RelationEvent MATCHING_PROPOSED`
- `AIEvent action=matching_proposed`

Elle ne fait jamais :

- envoi de message ;
- envoi d'email ;
- partage d'identite ;
- contact direct entre parties ;
- validation automatique de compatibilite.

L'humain garde le controle de la suite relationnelle.

## 7. Explainability-first

Les resultats de matching utilisent une structure explicable :

```json
{
  "compatibleElements": [],
  "semanticSignals": [],
  "clarificationsNeeded": [],
  "warnings": []
}
```

Ce que l'UI affiche :

- elements compatibles ;
- signaux relationnels ;
- clarifications necessaires ;
- warnings.

Ce que l'UI n'affiche pas :

- score brut ;
- distance vectorielle ;
- ranking opaque ;
- decision automatique.

## 8. Matching V1

Fichiers principaux :

- `lib/ai/matching.ts`
- `components/MatchingPanel.tsx`
- `app/api/cases/[caseId]/matching/route.ts`

Le matching V1 repose sur :

- filtrage `matchingEnabled=true` ;
- meme type/template de relation ;
- extraction de profil relationnel ;
- similarite textuelle mockee/deterministe ;
- explication par elements compatibles et clarifications.

Structure de profil :

```json
{
  "categories": [],
  "interests": [],
  "constraints": [],
  "location": "...",
  "budget": "...",
  "availability": "...",
  "relationType": "..."
}
```

V1 ne fait pas de pgvector. Il fournit une base explicable et testable.

## 9. Semantic Matching V2

Fichier principal :

- `lib/ai/semantic-matching.ts`

V2 ajoute :

- embeddings ;
- similarite semantique ;
- support pgvector ;
- `semanticSignals` ;
- fallback deterministic mock.

Route utilisee :

- `POST /api/cases/[caseId]/matching`

La route renvoie `semanticMatches` lorsque la couche semantique est disponible.

L'UI affiche :

- "Correspondance semantique detectee" ;
- "Signaux relationnels".

Elle ne montre pas le score interne.

## 10. Embeddings & pgvector

Modele Prisma :

- `RelationEmbedding`

Champs :

- `relationCaseId`
- `embeddingType`
- `contentHash`
- `vector Unsupported("vector")?`
- `createdAt`

Migrations :

- activation `CREATE EXTENSION IF NOT EXISTS vector`
- index cosine `ivfflat` sur `RelationEmbedding.vector`

Recherche vectorielle :

- fonction `semanticVectorSearch()` dans `lib/ai/semantic-matching.ts`
- distance cosine pgvector via `<=>`
- top-k retrieval ;
- threshold minimal ;
- logs d'observabilite.

Le vecteur est stocke en base via SQL brut `::vector`, ce qui conserve la compatibilite Prisma avec `Unsupported("vector")`.

## 11. Hybrid retrieval architecture

Le pipeline actuel est hybride :

1. SQL filtering :
   - meme proprietaire ;
   - `matchingEnabled=true` ;
   - meme template/type relationnel ;
   - exclusion du dossier source.

2. Vector retrieval :
   - embedding `case_summary` ;
   - cosine similarity pgvector ;
   - top-k ;
   - threshold minimal.

3. Explanation layer :
   - elements compatibles ;
   - signaux semantiques ;
   - clarifications ;
   - warnings.

4. UX :
   - resultats pseudonymises ;
   - aucune identite revelee ;
   - aucun score brut visible.

Si la recherche pgvector echoue ou si `AI_TEST_MODE=scenario`, le systeme conserve un fallback mock/deterministe.

## 12. Async embedding pipeline

Modele Prisma :

- `EmbeddingJob`

Champs :

- `relationCaseId`
- `status`: `pending`, `processing`, `completed`, `failed`
- `triggerType`
- `attempts`
- `lastError`
- `processedAt`
- `createdAt`
- `updatedAt`

Champs sur `RelationCase` :

- `embeddingStatus`: `fresh`, `stale`, `processing`
- `embeddingUpdatedAt`

Helper :

- `lib/ai/embedding-jobs.ts`

Worker :

- `scripts/process-embedding-jobs.mjs`

Commande :

```bash
npm.cmd run embeddings:worker
```

Triggers existants :

- nouveau message : `message_created`
- upload document : `document_uploaded`
- action relationnelle : `timeline_updated`
- activation matching : `manual_refresh`
- modification template IA : `template_changed`

Retry :

- maximum 3 tentatives ;
- apres 3 echecs : `status=failed` ;
- audit : `AIEvent action=embedding_job_failed`.

Le matching reste disponible lorsque `embeddingStatus` vaut `stale` ou `processing`. L'UI affiche alors :

> Analyse semantique en cours d'actualisation

## 13. Privacy-first matching

La privacy est integree avant matching et avant embedding.

Sanitization :

- emails remplaces ;
- tokens remplaces ;
- URLs privees ou signees remplacees ;
- secrets remplaces.

Fichiers concernes :

- `lib/ai/semantic-matching.ts`
- `scripts/process-embedding-jobs.mjs`
- `lib/ai/context.ts` pour les autres contextes IA.

Le matching respecte :

- opt-in uniquement ;
- pseudonymisation ;
- aucune revelation automatique d'identite ;
- aucun contact automatique ;
- auditabilite.

## 14. Trust & risk signals

Les signaux IA de confiance sont separes du matching, mais complementaires.

Route :

- `POST /api/cases/[caseId]/ai-risk-signals`

UI :

- `components/AIRiskSignalsPanel.tsx`

Ces signaux peuvent aider un humain a comprendre un dossier, mais ils ne bloquent pas le matching et ne produisent pas de decision automatique.

Ils respectent la meme doctrine :

- explication ;
- contextualisation ;
- recommandation ;
- decision humaine.

## 15. Audit & observability

Evenements IA principaux :

- `matching_analysis`
- `matching_proposed`
- `embedding_generated`
- `semantic_matching_analysis`
- `embedding_job_failed`

Evenements relationnels principaux :

- `MATCHING_OPT_IN_CHANGED`
- `MATCHING_PROPOSED`

Observabilite pgvector :

- duree requete ;
- nombre de candidats ;
- top matches internes dans les logs.

Observabilite worker :

- duree generation ;
- taille contexte ;
- nombre embeddings ;
- nombre de tentatives ;
- erreur eventuelle.

Les evenements techniques restent conserves en base. Leur rendu UX est humanise via :

- `lib/events/humanize.ts`

## 16. QA & deterministic validation

Scripts reels :

```bash
npm.cmd run qa:matching
npm.cmd run qa:matching:v2
npm.cmd run qa:matching:v2:real
npm.cmd run qa:embeddings
```

Suites :

- `scripts/qa-matching.mjs` : matching V1, dataset 200 profils ;
- `scripts/qa-matching-v2.mjs` : matching semantique V2, dataset 500 profils ;
- `scripts/qa-matching-v2-real.mjs` : semantic retrieval, 1000+ profils, synonymes, faux positifs, ambiguite ;
- `scripts/qa-embeddings.mjs` : jobs, retry, sanitizer, determinisme, stale warning.

Assertions couvertes :

- matching explicable ;
- absence de fuite sensible ;
- absence de score visible ;
- absence de decision automatique ;
- absence de discrimination ;
- faux positifs ;
- faux negatifs ;
- synonymes semantiques ;
- clarifications sur cas ambigus ;
- embeddings deterministes en QA ;
- pipeline non bloquant.

## 17. AI Act alignment direction

Le matching Goodissima n'est pas presente comme une certification AI Act. L'architecture actuelle va toutefois dans une direction compatible avec une gouvernance IA enterprise :

- supervision humaine ;
- transparence des finalites ;
- auditabilite ;
- explicabilite ;
- minimisation des donnees ;
- opt-in ;
- absence de decision automatique ;
- absence de scoring social ;
- tests de non-regression deterministes.

Cette base est pertinente pour des discussions banques, investisseurs ou partenaires, avec un cadrage legal/compliance specifique au contexte de deploiement.

## 18. Limitations & safeguards

Limitations actuelles :

- pas de reranking LLM complexe ;
- pas de tableau de bord qualite matching dedie ;
- pas de gestion de retention fine des embeddings ;
- providers embeddings distants non actives par defaut ;
- pgvector necessite une base Supabase/Postgres compatible.

Safeguards existants :

- fallback mock ;
- matching opt-in ;
- pseudonymisation ;
- aucun score brut UI ;
- aucun contact automatique ;
- warning si embeddings stale ;
- retry worker limite ;
- audit des echecs.

## 19. Future roadmap

Evolutions futures coherentes avec l'architecture :

- providers embeddings Mistral/OpenAI ;
- worker dedie ou cron Supabase ;
- purge et retention des embeddings ;
- monitoring de qualite matching ;
- tableaux de bord faux positifs/faux negatifs ;
- reranking explicable sans score opaque visible ;
- consentement plus granulaire ;
- export audit pour partenaires banques/investisseurs ;
- politiques de gouvernance multi-tenant.

Les invariants a conserver sont stables : opt-in, privacy-first, human-in-the-loop, auditabilite, explainability et absence de decision automatique.

## 20. Next.js migration roadmap

Le projet reste volontairement sur Next.js 14.2.35 a ce stade. Aucune migration framework n'est lancee dans ce chantier UX.

Constat de veille :

- Next.js publie une politique de support par version majeure, avec Next.js 16 en LTS active et Next.js 15 en maintenance LTS selon la documentation officielle Next.js Support Policy.
- Les guides officiels de migration recommandent une trajectoire par etapes : Next.js 14 vers 15, puis 15 vers 16, avec verification des changements React, Node.js, cache et App Router.

Roadmap proposee, sans casser l'architecture actuelle :

1. Inventaire technique
   - confirmer version Node.js cible ;
   - lister usages App Router, middleware, server actions, routes API et Prisma ;
   - identifier dependances React/Next sensibles.

2. Branche de migration isolee
   - creer une branche dediee ;
   - appliquer d'abord Next.js 15 ;
   - lancer QA IA, matching, embeddings, UI layout, UI polish, UI brand et build.

3. Verification comportementale
   - valider routes securisees ;
   - valider upload documents ;
   - valider audit AIEvent et RelationEvent ;
   - valider conversation sticky input et AI Workspace mobile.

4. Passage Next.js 16
   - appliquer les guides officiels Next.js 16 ;
   - verifier pre-requis Node.js ;
   - surveiller cache, rendering dynamique et middleware.

5. Validation produit
   - conserver architecture IA actuelle ;
   - conserver human-in-the-loop ;
   - conserver privacy-first ;
   - conserver matching gouverne et absence de score visible.

Sources de veille :

- https://nextjs.org/support-policy
- https://nextjs.org/docs/app/getting-started/upgrading
- https://nextjs.org/docs/app/guides/upgrading/version-16
