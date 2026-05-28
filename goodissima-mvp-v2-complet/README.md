# Goodissima MVP v2 complet

Copiez votre `.env` existant dans ce dossier puis lancez :

```bash
npm install
npx prisma generate
npm run dev
```

Ouvrez : http://localhost:3000

## Deploiement staging

Les exemples d'environnement sont separes par cible :

- local : `.env.example`
- staging / preview : `.env.staging.example`
- production : `.env.production.example`

Staging doit utiliser une base Supabase dediee, `NEXT_PUBLIC_APP_URL=https://preview.goodissima.app`, `AI_PROVIDER=mock` et `AI_TEST_MODE=scenario`. Les providers IA distants ne sont pas actifs par defaut.

Commandes principales :

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run qa:ai
npm run qa:matching
npm run qa:matching:v2
npm run qa:embeddings
npm run qa:ui-layout
npm run qa:ui-brand
```

La checklist complete est dans `docs/STAGING_CHECKLIST_GOODISSIMA.md`.
