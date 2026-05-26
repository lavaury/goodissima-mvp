# Async Embedding Pipeline

Goodissima V2.2 traite les embeddings en asynchrone pour garder le matching rapide et non bloquant.

## Pipeline

1. Un evenement relationnel cree un `EmbeddingJob`.
2. Le dossier passe en `embeddingStatus=stale`.
3. Le worker `npm.cmd run embeddings:worker` traite les jobs `pending`.
4. Le worker genere un embedding privacy-first, stocke le vecteur et marque le dossier `fresh`.

## Eventual Consistency

Le matching reste disponible pendant l'actualisation. Si les embeddings sont `stale` ou `processing`, l'UI affiche un avertissement leger : l'analyse semantique est en cours d'actualisation.

## Retry

Chaque job est tente jusqu'a 3 fois. Apres 3 echecs :

- `status=failed`,
- `lastError` renseigne,
- `AIEvent action=embedding_job_failed` cree.

## Scalabilite

Le worker traite un batch configurable via `EMBEDDING_JOB_BATCH_SIZE`. Le modele est future-ready pour une file externe, un cron Supabase ou un worker dedie.

## Observabilite

Les logs incluent :

- temps generation,
- taille contexte,
- nombre embeddings,
- nombre de tentatives.

## Privacy-first

Avant generation, le contexte est sanitise : emails, tokens, URLs signees et secrets sont remplaces par des marqueurs prives.
