# Goodissima AI Scenario Test Harness

Ce dossier contient des scenarios IA deterministes pour tester les comportements relationnels typiques sans appeler Mistral. Ils jouent le role de bouchons ou simulateurs de qualification : chaque situation connue produit une sortie stable, ce qui facilite la non-regression.

## Objectif

- Tester les comportements IA sur des cas immobiliers, recrutement, investisseurs, privacy et dossiers trop legers.
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

Il valide les champs requis, le JSON, l'absence de donnees sensibles, les termes attendus, les types d'actions et le cas `notEnoughContent`.

## Ajouter un scenario

1. Creer un fichier dans `fixtures/` avec les champs `id`, `title`, `template`, `relation`, `messages`, `documents`, `actions` et `expected`.
2. Ajouter le snapshot deterministe correspondant dans `expected/<id>.expected.json`.
3. Ajouter la sortie stable dans le mock provider si le scenario doit etre rejoue par le service applicatif.
4. Lancer `npm.cmd run qa:ai:scenarios`.

## Limites

- Ces tests ne mesurent pas la qualite generative d'un LLM reel.
- Ils ne remplacent pas une validation humaine des formulations sensibles.
- Ils ne doivent pas declencher d'action, email, upload, authentification ou token.
- Ils servent surtout de filet de non-regression et de specification executable.

## Futur Matching

Le dossier `qa/ai/matching/` est reserve aux futurs tests de matching. Il contiendra des offres, recherches, scores attendus, cas negatifs et cas ambigus.
