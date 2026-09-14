# MATCH-IDEMPOTENCY-KEY-01

Status: OPEN.

`MatchingRun.idempotencyKey` is currently stored as the raw client-provided value. B5.1 does not add any new dependency on that value and does not log it, but it intentionally leaves the existing column and unique constraint unchanged to avoid broadening the safety-foundation migration.

A later matching hardening lot must replace new writes and lookups with an HMAC-SHA-256 representation using explicit domain separation, define compatibility for historical runs, then retire the raw column through a separately reviewed migration. No backfill or Production operation is authorized by B5.1.
