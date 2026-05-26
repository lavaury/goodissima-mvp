# Responsible Matching V2 - Semantic Layer

V2 ajoute une couche semantique au matching V1 avec une architecture hybrid retrieval :

1. SQL filtering : opt-in obligatoire, meme type de relation/template.
2. Semantic retrieval : embeddings privacy-first, mock deterministe par defaut, future compatibilite pgvector.
3. Explanation layer : elements compatibles, signaux semantiques, clarifications, warnings.

Principes de gouvernance :

- aucune decision automatique,
- aucun contact automatique,
- aucun score brut visible,
- aucune identite revelee automatiquement,
- human-in-the-loop pour toute proposition,
- embeddings generes depuis un contexte sanitise.

AI Act alignment :

- supervision humaine,
- audit `embedding_generated` et `semantic_matching_analysis`,
- explicabilite,
- minimisation des donnees,
- tests deterministes reproductibles.

Commande :

```bash
npm.cmd run qa:matching:v2
```
