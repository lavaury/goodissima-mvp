# Goodissima AI Governance

## 1. Vision

Goodissima utilise l'IA comme copilote relationnel gouverne, privacy-first et human-in-the-loop. L'objectif n'est pas d'automatiser une decision, mais d'aider un proprietaire, une equipe ou un partenaire a mieux comprendre une relation, preparer une reponse, identifier des points de vigilance et explorer des correspondances potentielles de maniere explicable.

L'architecture actuelle privilegie trois garanties produit :

- les suggestions IA restent consultatives ;
- les actions sensibles restent declenchees par un humain ;
- les traitements IA sont auditables via `AIEvent` et, lorsque pertinent, `RelationEvent`.

## 2. Principes IA Goodissima

Principes appliques dans le code et dans l'interface :

- l'IA suggere, l'humain decide ;
- aucune decision automatique ;
- aucune action automatique ;
- aucun contact automatique ;
- aucun scoring opaque visible ;
- aucune revelation automatique d'identite dans le matching ;
- aucune discrimination ou jugement moral ;
- minimisation des donnees envoyees aux providers IA ;
- exclusion des emails, tokens, URLs privees et secrets dans les contextes IA ;
- audit des actions IA et des acceptations humaines.

Ces principes sont exposes dans le centre `IA & Gouvernance` de la page Parametres (`app/settings/page.tsx`).

## 3. Human-in-the-loop

Les features IA sont concues pour produire des informations, brouillons ou recommandations, mais pas pour agir seules.

Exemples existants :

- `components/AIRelationSummaryPanel.tsx` affiche des suggestions d'actions. Une `RelationAction` n'est creee qu'apres clic humain via `POST /api/cases/[caseId]/ai-suggested-actions`.
- `components/AITimelineIntelligencePanel.tsx` propose des prochaines actions. L'action n'est creee qu'apres acceptation humaine via `POST /api/cases/[caseId]/ai-timeline-suggestions`.
- `components/AIDraftAssistantPanel.tsx` genere un brouillon. Le bouton "Utiliser dans la conversation" pre-remplit seulement l'editeur de `ChatBox`; il n'appelle pas `POST /api/messages`.
- `components/MatchingPanel.tsx` affiche des correspondances pseudonymisees. Le bouton "Proposer une relation" cree uniquement une suggestion relationnelle via `POST /api/cases/[caseId]/matching-proposals`; aucun contact direct n'est envoye.

Ce que l'IA ne fait jamais :

- envoyer un message automatiquement ;
- envoyer un email automatiquement ;
- creer une action sans clic humain ;
- valider, refuser ou bloquer un dossier ;
- reveler automatiquement une identite dans le matching.

## 4. Explainability

Les sorties IA sont structurees pour rester lisibles et verifiables :

- `AISummary` : `summary`, `keyPoints`, `risks`, `suggestedActions`, `missingDocuments`.
- `AITimelineIntelligence` : `timelineStatus`, `inactiveSinceDays`, `blockers`, `nextBestActions`, `alerts`.
- `AIDraft` : `draftType`, `subject`, `message`, `tone`, `warnings`.
- `AIRiskAnalysis` : `riskSignals` avec `type`, `severity`, `title`, `explanation`, `recommendation`.
- Matching V1/V2 : `compatibleElements`, `semanticSignals`, `clarificationsNeeded`, `warnings`.

Le matching ne montre pas de score brut dans l'UI. Les correspondances affichent des raisons explicables : elements compatibles, signaux relationnels, besoins de clarification et warnings.

## 5. Privacy-first Architecture

Les contextes IA sont construits avec minimisation et sanitization.

Composants et services principaux :

- `lib/ai/context.ts` construit le contexte relationnel IA, supprime emails, URLs et tokens longs, et limite la taille du texte.
- `app/api/cases/[caseId]/ai-timeline/route.ts`, `ai-draft/route.ts` et `ai-risk-signals/route.ts` appliquent aussi une sanitization avant appel IA.
- `lib/ai/semantic-matching.ts` sanitise le texte avant generation d'embeddings.
- `scripts/process-embedding-jobs.mjs` applique un sanitizer dans le worker asynchrone.

Donnees exclues ou remplacees :

- emails ;
- tokens ;
- URLs privees ou signees ;
- secrets et API keys ;
- donnees systeme non utiles au contexte relationnel.

Le matching est pseudonymise dans l'UI : les resultats apparaissent comme relations compatibles, sans identite revelee automatiquement.

## 6. AI Providers

Provider applicatif :

- `lib/ai/providers/mock.ts` : provider mock par defaut, avec sorties deterministes en mode scenario.
- `lib/ai/providers/mistral.ts` : provider Mistral-ready pour summary, timeline, drafts et risk signals avec parsing JSON strict.
- `lib/ai/service.ts` : selectionne le provider. Si `AI_PROVIDER=mistral` sans `MISTRAL_API_KEY`, le systeme revient au mock.

Embeddings :

- `lib/ai/embeddings/mock.ts` : embeddings mock deterministes.
- `lib/ai/embeddings/index.ts` : abstraction provider embeddings, avec extension future-ready pour Mistral/OpenAI.

Provider par defaut :

```bash
AI_PROVIDER=mock
```

Mode QA deterministe :

```bash
AI_TEST_MODE=scenario
```

## 7. AI Features

### Resume IA

Route : `POST /api/cases/[caseId]/ai-summary`

UI : `components/AIRelationSummaryPanel.tsx`

Produit :

- resume relationnel ;
- points cles ;
- risques ;
- documents manquants ;
- suggestions d'actions consultatives.

Ne fait jamais :

- decision automatique ;
- creation d'action sans validation ;
- envoi email.

### Timeline Intelligence

Route : `POST /api/cases/[caseId]/ai-timeline`

Acceptation humaine : `POST /api/cases/[caseId]/ai-timeline-suggestions`

UI : `components/AITimelineIntelligencePanel.tsx`

Produit :

- etat relationnel ;
- inactivite ;
- blocages ;
- alertes ;
- prochaines actions recommandees.

Ne fait jamais :

- action automatique ;
- blocage de dossier ;
- decision.

### Assistant redaction IA

Route : `POST /api/cases/[caseId]/ai-draft`

Audit d'usage : `POST /api/cases/[caseId]/ai-draft-used`

UI : `components/AIDraftAssistantPanel.tsx`

Types supportes :

- `FOLLOW_UP`
- `DOCUMENT_REQUEST`
- `CLARIFICATION_REQUEST`
- `INVESTOR_REPLY`
- `PROFESSIONAL_RESPONSE`

Ne fait jamais :

- envoyer le brouillon ;
- envoyer un email ;
- promettre un resultat ;
- exercer une pression abusive.

### Trust Signals

Route : `POST /api/cases/[caseId]/ai-risk-signals`

Audit action humaine : `POST /api/cases/[caseId]/ai-risk-signal-action`

UI : `components/AIRiskSignalsPanel.tsx`

Produit :

- signaux de vigilance contextualises ;
- gravite `low`, `medium`, `high` ;
- explication ;
- recommandation optionnelle.

Ne fait jamais :

- score global ;
- refus automatique ;
- profiling interdit ;
- jugement moral.

## 8. Matching Governance

Le matching est opt-in.

Donnees :

- `RelationCase.matchingEnabled` ;
- `RelationCase.embeddingStatus` ;
- `RelationCase.embeddingUpdatedAt`.

Opt-in :

- proprietaire : `components/MatchingOptInPanel.tsx` ;
- candidat : meme panneau dans la vue secure, libelle candidat ;
- route : `PATCH /api/cases/[caseId]/matching-opt-in`.

Matching V1 :

- route : `POST /api/cases/[caseId]/matching` ;
- moteur explicable : `lib/ai/matching.ts` ;
- UI : `components/MatchingPanel.tsx`.

Le matching ne revele pas automatiquement l'identite. Une proposition relationnelle est seulement une suggestion auditee :

- route : `POST /api/cases/[caseId]/matching-proposals` ;
- audit : `AIEvent action=matching_proposed` et `RelationEvent MATCHING_PROPOSED`.

## 9. Semantic Matching V2

Le semantic matching V2 ajoute une couche semantique au matching V1.

Service : `lib/ai/semantic-matching.ts`

Pipeline :

1. filtrage SQL : meme proprietaire, `matchingEnabled=true`, meme type/template ;
2. retrieval semantique : embeddings et similarite cosine ;
3. explanation layer : signaux semantiques, elements compatibles, clarifications, warnings.

UI :

- "Correspondance semantique detectee" ;
- "Signaux relationnels" ;
- pas de score brut visible.

Audit :

- `AIEvent action=semantic_matching_analysis`.

Fallback :

- si `AI_TEST_MODE=scenario` ou si la recherche pgvector echoue, le systeme conserve un fallback mock/deterministe.

## 10. Embeddings & pgvector

Table Prisma : `RelationEmbedding`

Champs :

- `relationCaseId`
- `embeddingType`
- `contentHash`
- `vector Unsupported("vector")?`
- `createdAt`

Migration pgvector :

- `CREATE EXTENSION IF NOT EXISTS vector`
- index cosine `ivfflat` sur `RelationEmbedding.vector`

Service :

- `generateCaseEmbedding(caseId)` dans `lib/ai/semantic-matching.ts`
- `semanticVectorSearch()` pour la recherche cosine avec `<=>`

Le vecteur est stocke en base via SQL brut `::vector`, tandis que Prisma conserve la compatibilite avec `Unsupported("vector")`.

Observabilite :

- duree de requete ;
- nombre de candidats ;
- top matches internes dans les logs ;
- aucun score brut expose a l'UI.

## 11. Async Embedding Pipeline

Table Prisma : `EmbeddingJob`

Champs :

- `relationCaseId`
- `status`: `pending`, `processing`, `completed`, `failed`
- `triggerType`
- `attempts`
- `lastError`
- `processedAt`
- `createdAt`
- `updatedAt`

Triggers existants :

- nouveau message : `message_created` dans `app/api/messages/route.ts` ;
- upload document : `document_uploaded` dans `app/api/documents/upload/route.ts` ;
- action relationnelle : `timeline_updated` dans `app/api/cases/[caseId]/actions/route.ts` ;
- opt-in matching : `manual_refresh` dans `app/api/cases/[caseId]/matching-opt-in/route.ts` ;
- modification instructions IA template : `template_changed` dans `app/api/templates/[templateId]/ai-instructions/route.ts`.

Worker :

```bash
npm.cmd run embeddings:worker
```

Script :

- `scripts/process-embedding-jobs.mjs`

Retry :

- maximum 3 tentatives ;
- apres 3 echecs : `status=failed` ;
- audit : `AIEvent action=embedding_job_failed`.

Comportement UX :

- le matching reste disponible si les embeddings sont `stale` ou `processing` ;
- warning affiche : "Analyse semantique en cours d'actualisation" ;
- aucun blocage utilisateur.

## 12. Audit & AIEvent

Modele Prisma : `AIEvent`

Champs principaux :

- `caseId`
- `provider`
- `model`
- `action`
- `status`
- `promptVersion`
- `outputSummary`
- `errorCode`
- `createdAt`

Actions IA existantes :

- `summary`
- `suggested_action`
- `timeline_intelligence`
- `timeline_suggestion_accepted`
- `draft_generation`
- `draft_used`
- `risk_analysis`
- `risk_signal_action_taken`
- `matching_analysis`
- `matching_proposed`
- `embedding_generated`
- `semantic_matching_analysis`
- `embedding_job_failed`

Le journal IA recent est affiche dans la section `IA & Gouvernance` de `app/settings/page.tsx`.

Les evenements relationnels restent conserves techniquement en base, puis humanises pour l'UX via `lib/events/humanize.ts`.

## 13. QA & Deterministic Scenarios

Scripts QA reels :

```bash
npm.cmd run qa:ai
npm.cmd run qa:ai:scenarios
npm.cmd run qa:matching
npm.cmd run qa:matching:v2
npm.cmd run qa:matching:v2:real
npm.cmd run qa:embeddings
npm.cmd run qa:events
```

Suites QA :

- `qa/ai/test-cases` : contrats IA de base ;
- `qa/ai/scenarios` : scenarios deterministes avancees ;
- `qa/ai/matching` : matching V1 avec 200 profils generes ;
- `qa/ai/matching-v2` : matching semantique avec 500 profils ;
- `qa:matching:v2:real` : dataset 1000+ profils, synonymes, faux positifs, ambiguite, explainability ;
- `qa/ai/embeddings` : pipeline async, retry, staleness, determinisme ;
- `qa:events` : mapping UX des evenements.

Assertions couvertes :

- JSON valide ;
- provider mock par defaut ;
- absence de fuite sensible ;
- pas de score visible ;
- pas de decision automatique ;
- pas de discrimination ;
- explainability presente ;
- faux positifs et faux negatifs matching ;
- embeddings deterministes en QA ;
- comportement non bloquant si embeddings stale.

## 14. AI Act Alignment Direction

Goodissima n'implemente pas une certification AI Act dans le code. L'architecture actuelle va toutefois dans une direction compatible avec des exigences de gouvernance :

- supervision humaine obligatoire ;
- audit des traitements IA ;
- transparence des finalites ;
- explicabilite des sorties ;
- minimisation des donnees ;
- privacy-first context building ;
- separation entre suggestion et action ;
- tests de non-regression deterministes ;
- journalisation des echecs du pipeline embedding.

Cette base est adaptee a une discussion enterprise avec banques, investisseurs et partenaires, sous reserve d'un cadrage legal et compliance specifique au deploiement.

## 15. Security & Privacy

Garanties implementees :

- sanitization des contextes IA ;
- suppression ou remplacement des emails, tokens, URLs privees et secrets ;
- matching opt-in ;
- pseudonymisation des correspondances ;
- absence de contact automatique ;
- absence de revelation automatique d'identite ;
- audit des actions IA ;
- fallback mock si provider externe non configure.

Points a surveiller en production :

- configuration stricte des variables d'environnement IA ;
- politiques de retention des embeddings ;
- gouvernance des prompts et instructions template ;
- supervision des logs pour eviter les donnees sensibles ;
- migration pgvector validee dans l'environnement Supabase cible.

## 16. Future Roadmap

Axes futurs coherents avec l'architecture actuelle :

- providers embeddings distants Mistral/OpenAI via `lib/ai/embeddings`;
- worker dedie ou cron Supabase pour `EmbeddingJob`;
- deduplication avancee des embeddings par `contentHash`;
- retention et purge des embeddings ;
- dashboards de qualite matching ;
- evaluation plus fine des faux positifs et faux negatifs ;
- reranking explicable, sans score opaque visible ;
- gouvernance multi-tenant et role admin plus granulaire ;
- export audit IA pour partenaires banques/investisseurs.

Ces evolutions doivent conserver les invariants existants : human-in-the-loop, privacy-first, auditabilite, absence de decision automatique et explicabilite.
