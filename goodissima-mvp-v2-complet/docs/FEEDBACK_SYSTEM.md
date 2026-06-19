# Feedback System

## Current Storage

Feedback is received by `POST /api/feedback` and stored on the application server filesystem.

- Storage type: JSON Lines file
- File path: `.feedback/feedback.jsonl` from `process.cwd()`
- Database table: none
- Email notification: none
- Slack/webhook notification: none
- Logs: yes, a short `console.info("[feedback]", { id, type, role })` entry is emitted after persistence

Because storage is local filesystem based, production deployments must ensure `.feedback/feedback.jsonl` is written to persistent storage. On ephemeral hosts, container filesystems, or serverless environments, feedback can be lost between deploys or instance restarts.

## Receiving Endpoint

Endpoint:

```txt
POST /api/feedback
```

Implementation:

```txt
app/api/feedback/route.ts
```

UI entry point:

```txt
components/FeedbackButton.tsx
```

The global feedback button is mounted from:

```txt
app/layout.tsx
```

## Persisted Fields

The API currently persists the following JSON object per line:

```ts
{
  id: string;
  type: "Bug" | "Suggestion" | "UX" | "Compréhension" | "Autre";
  message: string;
  page: string | null;
  role: string;
  userId: string | null;
  caseId: string | null;
  templateId: string | null;
  clientTimestamp: string | null;
  serverTimestamp: string;
}
```

Field coverage:

| Requested field | Current field | Persisted |
| --- | --- | --- |
| type | `type` | Yes |
| message | `message` | Yes |
| route | `page` | Yes |
| role | `role` | Yes |
| user id | `userId` | Yes, when authenticated and matched to `User` |
| timestamp | `clientTimestamp`, `serverTimestamp` | Yes |
| browser info | none | No |
| environment | none | No |

The frontend sends `type`, `message`, `page`, `caseId`, `templateId`, and `timestamp`. The backend resolves `role`, `userId`, and `serverTimestamp`.

## Review Process

There is currently no in-app review interface.

Administrators can review feedback only by accessing the server file:

```txt
.feedback/feedback.jsonl
```

Example operational review command:

```bash
tail -n 100 .feedback/feedback.jsonl
```

Each line is a standalone JSON object.

## Notifications

There are currently no feedback notifications:

- Email: none
- Slack: none
- Webhook: none
- In-app admin notification: none

Only a server log summary is emitted.

## Database Status

Feedback is not currently stored in the database.

There is no Prisma model for product feedback. The only `feedback` field currently present in Prisma is unrelated template revision metadata: `TemplateGeneration.revisionFeedback`.

Retention strategy today: none. Feedback JSONL is retained until the file is manually rotated, deleted, or lost with the hosting filesystem.

## FEEDBACK-ADMIN-01 Proposal

If a review interface is required, implement `Administration > Feedback` backed by a database table.

Recommended capabilities:

- List feedback entries
- Filter by type:
  - Bug
  - UX
  - Suggestion
  - Compréhension
  - Autre
- Filter by status:
  - Nouveau
  - En cours
  - Résolu
  - Ignoré
- Search in message, page, user id, case id, template id
- Export CSV
- Detail drawer with timestamps and context

Suggested Prisma model:

```prisma
enum FeedbackType {
  BUG
  UX
  SUGGESTION
  COMPREHENSION
  AUTRE
}

enum FeedbackStatus {
  NEW
  IN_PROGRESS
  RESOLVED
  IGNORED
}

model ProductFeedback {
  id              String         @id @default(cuid())
  type            FeedbackType
  status          FeedbackStatus @default(NEW)
  message         String
  page            String?
  role            String
  userId          String?
  caseId          String?
  templateId      String?
  browserInfo     Json?
  environment     String?
  clientTimestamp DateTime?
  serverTimestamp DateTime       @default(now())
  resolvedAt      DateTime?
  resolutionNote  String?

  @@index([type])
  @@index([status])
  @@index([serverTimestamp])
  @@index([userId])
}
```

Recommended retention:

- Keep unresolved feedback until resolved or explicitly ignored.
- Keep resolved/ignored feedback for 180 days by default.
- Export/archive before deletion if needed for product analytics.
- Avoid storing sensitive personal data in `message`; add admin guidance and optional redaction if feedback becomes database-backed.

## Production Configuration Guidance

Current file-backed mode:

- Mount `.feedback/` on persistent storage.
- Ensure the application process can create and append to `.feedback/feedback.jsonl`.
- Include `.feedback/` in backup policy if feedback is operationally important.
- Configure log aggregation to capture `[feedback]` entries for basic monitoring.
- Do not rely on local filesystem storage on serverless or multi-instance deployments unless a shared persistent volume is configured.

Recommended production target:

- Move feedback to a database-backed `ProductFeedback` model.
- Add `Administration > Feedback`.
- Add optional notification routing for high-priority `Bug` feedback.
- Add retention cleanup for resolved/ignored records.
