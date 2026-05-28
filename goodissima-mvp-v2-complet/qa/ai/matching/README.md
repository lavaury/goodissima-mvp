# Responsible Matching V1 QA

Sandbox de matching relationnel privacy-first.

Principes :

- matching opt-in uniquement,
- aucune revelation automatique d'identite,
- aucun score opaque visible,
- aucune decision automatique,
- human-in-the-loop pour toute proposition,
- resultats explicables par elements compatibles, clarifications et warnings.

Le dataset large est genere deterministiquement par `scripts/qa-matching.mjs` :

- 100 candidats immobiliers,
- 50 offres immobiliieres,
- 30 investisseurs,
- 20 partenaires strategiques,
- cas forts, faibles, incompatibles, ambigus et limites.

Commande :

```bash
npm.cmd run qa:matching
```
