# Goodissima AI QA Test Suite

Suite de qualification manuelle et semi-automatisee des fonctionnalites IA Goodissima. Les tests utilisent uniquement le provider mock et ne doivent pas appeler Mistral par defaut.

## Structure

- `test-cases/` decrit les cas QA, les features couvertes, les fixtures, les expected et les criteres d'acceptation.
- `fixtures/` contient les dossiers fictifs et les contextes IA privacy-first.
- `expected/` contient les contrats attendus pour les sorties IA, le human-in-the-loop et les erreurs.

## Couverture actuelle

- AI Summary
- AI Suggested Actions
- Template AI Instructions
- Privacy-first context builder
- AIEvent audit

## Lancer la validation locale

```bash
npm run qa:ai
```

Le script valide :

- JSON valide pour tous les cas, fixtures et expected.
- Provider `mock` uniquement.
- Structure minimale des contextes IA et des expected.
- Types `suggestedActions` autorises.
- Absence de valeurs sensibles dans `aiContext` : emails, URLs, tokens longs, marqueurs de signed URL, secrets et API keys.
- Contrat human-in-the-loop : aucune action avant clic, creation apres clic, `RelationEvent AI_SUGGESTED_ACTION_ACCEPTED`, `AIEvent action=suggested_action`, aucun email automatique.
- Contrat dossier trop leger : `INSUFFICIENT_CONTEXT` avec le message utilisateur attendu.

## Procedure manuelle

1. Lancer `npm run qa:ai`.
2. Pour chaque fichier `test-cases/*.json`, charger la fixture associee dans un environnement local ou via le provider mock.
3. Declencher la fonctionnalite indiquee dans `features`.
4. Comparer la reponse avec le fichier `expected` associe.
5. Verifier explicitement les `manualAcceptanceCriteria`.
6. Pour les suggested actions, verifier qu'aucune `RelationAction` n'existe avant clic humain.
7. Accepter une suggestion depuis l'UI ou l'API dediee, puis verifier la creation de la `RelationAction`, du `RelationEvent` et du `AIEvent`.
8. Confirmer qu'aucun email automatique n'a ete envoye.

## Regles de securite attendues

- Ne jamais exposer email, token, signed URL, secret ou API key dans le contexte IA.
- Ne jamais prendre de decision automatique.
- Ne jamais produire de jugement discriminatoire.
- Ne jamais creer d'action automatiquement depuis une suggestion IA.
- Les instructions de template restent subordonnees aux regles globales Goodissima.
