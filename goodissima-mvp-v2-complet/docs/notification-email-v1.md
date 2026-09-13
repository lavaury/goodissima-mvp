# Notification email V1

`Notification` is the reference event. Owner email is a best-effort channel evaluated only after a newly created notification has committed. Missing Resend configuration, provider failure, disabled preferences, cooldown, or non-immediate frequency never removes the internal notification.

Only `IMMEDIATE` is delivered in V1. `DAILY` and `WEEKLY` are retained user choices but intentionally produce no immediate email until **NOTIF-MAIL-DIGEST** adds a scheduler and digest.

The 30-minute `NEW_MESSAGE` cooldown uses earlier persisted notifications for the same recipient and Dossier. It is not a delivery ledger. **NOTIF-MAIL-DELIVERY** remains the future scope for an outbox, durable retries, delivery status, `emailedAt`, and bounce handling.

Candidate emails remain a separate consent-based legacy channel because an anonymous candidate need not have a `User`. Owner notification emails contain only a safe business label and the authenticated `/cases/{id}` destination; they never copy conversation or identity data.
