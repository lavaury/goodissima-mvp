# Goodissima AI Scenario Test Harness

Ce dossier contient des scenarios IA deterministes pour tester les comportements relationnels typiques sans appeler Mistral. Ils jouent le role de bouchons ou simulateurs de qualification : chaque situation connue produit une sortie stable, ce qui facilite la non-regression.

## Objectif

- Tester les comportements IA sur des cas immobiliers, recrutement, investisseurs, privacy, timeline, brouillons de messages, signaux de confiance et dossiers trop legers.
- Verifier les risques, documents manquants et suggested actions attendues.
- Garder des tests reproductibles avec `AI_PROVIDER=mock` et `AI_TEST_MODE=scenario`.
- Preparer les futurs scenarios de matching sans les implementer maintenant.

## Comment lancer

```bash
npm.cmd run qa:ai:scenarios
```

Le script force le mode local :

```bash
AI_PROVIDER=mock
AI_TEST_MODE=scenario
```

Il valide les champs requis, le JSON, l'absence de donnees sensibles, les termes attendus, les types d'actions, les sorties timeline, les brouillons IA, les signaux de risque/confiance et le cas `notEnoughContent`.

## Ajouter un scenario

1. Creer un fichier dans `fixtures/` avec les champs `id`, `title`, `template`, `relation`, `messages`, `documents`, `actions` et `expected`.
2. Ajouter le snapshot deterministe correspondant dans `expected/<id>.expected.json`.
3. Ajouter la sortie stable dans le mock provider si le scenario doit etre rejoue par le service applicatif.
4. Lancer `npm.cmd run qa:ai:scenarios`.

## Timeline Intelligence

Les scenarios `timeline_*` verifient les sorties deterministes de l'analyse de timeline :

- conversation inactive,
- demande de document en attente,
- message sans reponse,
- dossier complet pret pour revue,
- echange confus necessitant clarification.

Les suggestions timeline restent human-in-the-loop : elles ne creent une `RelationAction` qu'apres clic humain, puis auditent `AIEvent action=timeline_suggestion_accepted` et `RelationEvent AI_TIMELINE_SUGGESTION_ACCEPTED`.

## Draft Assistant

Les scenarios de brouillons verifient les types `FOLLOW_UP`, `DOCUMENT_REQUEST`, `CLARIFICATION_REQUEST`, `INVESTOR_REPLY` et `PROFESSIONAL_RESPONSE`.

Le brouillon est seulement copie ou place dans l'editeur de conversation. L'envoi reste manuel et separe, avec audit `AIEvent action=draft_used` et `RelationEvent AI_DRAFT_USED` lorsque l'utilisateur choisit de l'utiliser.

## Risk & Trust Signals

Les signaux sont des observations contextualisees, pas des decisions. Ils n'ont pas de score global cache, ne refusent rien automatiquement et ne bloquent aucun dossier.

Principes :

- human-in-the-loop obligatoire,
- explication et recommandation lisibles,
- wording neutre et non accusatoire,
- pas de discrimination, profilage interdit, jugement moral ou langage agressif,
- alignement AI Act par transparence, auditabilite, supervision humaine et minimisation des donnees.

Limites : ces signaux aident a prioriser une verification humaine, mais ne remplacent pas l'analyse metier, juridique ou operationnelle.

## Limites

- Ces tests ne mesurent pas la qualite generative d'un LLM reel.
- Ils ne remplacent pas une validation humaine des formulations sensibles.
- Ils ne doivent pas declencher d'action, email, upload, authentification ou token.
- Ils servent surtout de filet de non-regression et de specification executable.

## Futur Matching

Le dossier `qa/ai/matching/` est reserve aux futurs tests de matching. Il contiendra des offres, recherches, scores attendus, cas negatifs et cas ambigus.
