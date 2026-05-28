# Checklist staging Goodissima

Objectif : separer proprement local, staging/preview et production sans exposer de secrets ni activer de provider IA distant par defaut.

## 1. Environnements

- Local : `GOODISSIMA_ENV=local`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- Staging / preview : `GOODISSIMA_ENV=staging`, `NEXT_PUBLIC_APP_URL=https://preview.goodissima.app`.
- Production : `GOODISSIMA_ENV=production`, `NEXT_PUBLIC_APP_URL=https://app.goodissima.app`.

## 2. Variables staging Vercel

Creer les variables depuis `.env.staging.example` dans Vercel Preview :

- `GOODISSIMA_ENV=staging`
- `GOODISSIMA_DEBUG_MODE=false`
- `NEXT_PUBLIC_APP_URL=https://preview.goodissima.app`
- `DATABASE_URL` vers la base Supabase staging
- `DIRECT_URL` vers la base Supabase staging pour Prisma migrations / connexions directes si necessaire
- `SUPABASE_URL` vers le projet Supabase staging pour les usages serveur eventuels
- `NEXT_PUBLIC_SUPABASE_URL` vers le projet Supabase staging
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` staging
- `SUPABASE_SERVICE_ROLE_KEY` staging
- `AI_PROVIDER=mock`
- `AI_TEST_MODE=scenario`
- `AI_EMBEDDING_PROVIDER=mock`
- `FEATURE_AI=true`
- `FEATURE_MATCHING=true`
- `FEATURE_ANALYTICS=true`
- `FEATURE_EXPERIMENTAL=false`

Ne pas renseigner `MISTRAL_API_KEY` en staging tant qu'un test provider distant n'est pas explicitement approuve.

## 3. Variables production Vercel

Creer les variables depuis `.env.production.example` dans Vercel Production :

- `GOODISSIMA_ENV=production`
- `GOODISSIMA_DEBUG_MODE=false`
- `NEXT_PUBLIC_APP_URL=https://app.goodissima.app`
- `DATABASE_URL` vers la base Supabase production
- `DIRECT_URL` vers la base Supabase production pour Prisma migrations / connexions directes si necessaire
- `SUPABASE_URL` vers le projet Supabase production pour les usages serveur eventuels
- `AI_PROVIDER=mock`
- `AI_TEST_MODE=scenario`
- `AI_EMBEDDING_PROVIDER=mock`
- `FEATURE_EXPERIMENTAL=false`

Verifier que staging et production utilisent deux projets Supabase ou deux bases strictement separes.

## 4. Supabase staging

Actions manuelles :

1. Creer un projet Supabase staging dedie.
2. Activer l'extension pgvector si elle n'est pas deja disponible : `CREATE EXTENSION IF NOT EXISTS vector;`.
3. Configurer `DATABASE_URL` avec une connexion PostgreSQL compatible Prisma migrations.
4. Executer les migrations : `npm run prisma:migrate:deploy`.
5. Generer le client Prisma : `npm run prisma:generate`.
6. Verifier que les tables applicatives ont RLS active sans policy navigateur directe.
7. Verifier que l'anon key ne permet pas de lire/ecrire directement les tables applicatives.

## 5. Vercel staging

Actions manuelles :

1. Creer le domaine preview `preview.goodissima.app` dans le projet Vercel.
2. Affecter les variables `.env.staging.example` a l'environnement Preview.
3. Verifier que les deploy previews utilisent `AI_PROVIDER=mock` et `AI_TEST_MODE=scenario`.
4. Lancer un deploiement Preview.
5. Executer les suites QA apres deploiement.

## 6. DNS Gandi

Actions manuelles :

1. Ajouter l'enregistrement DNS demande par Vercel pour `preview.goodissima.app`.
2. Ajouter ou verifier l'enregistrement DNS pour `app.goodissima.app`.
3. Attendre la propagation DNS et valider les certificats TLS dans Vercel.

## 7. QA staging

Commandes a executer :

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

Checks attendus :

- Debug UI/API non visibles avec `GOODISSIMA_DEBUG_MODE=false`.
- Aucun provider IA distant appele par defaut.
- Matching V2 fonctionne avec fallback mock/deterministe.
- Embeddings compatibles pgvector et non bloquants si le worker n'a pas encore traite les jobs.
- `NEXT_PUBLIC_APP_URL` genere des liens candidats sur `https://preview.goodissima.app`.
- Aucun secret n'apparait dans les logs, emails, contextes IA ou pages publiques.

## 8. Go / no-go production

Avant production :

- `GOODISSIMA_DEBUG_MODE=false`
- `FEATURE_EXPERIMENTAL=false`
- `NEXT_PUBLIC_APP_URL=https://app.goodissima.app`
- migrations appliquees avec succes
- RLS verifiee
- QA verte
- DNS et TLS valides
- decision explicite sur le provider IA distant, sinon conserver `AI_PROVIDER=mock`
