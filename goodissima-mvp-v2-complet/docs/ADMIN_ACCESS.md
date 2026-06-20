# Production admin access

Goodissima stores the application role in `User.role`. The supported bootstrap
roles are `SUPER_ADMIN` and `PRODUCT_OWNER`.

Both roles grant access to product feedback administration and Tests Champagne.
The Administration and IA & Valeur pages currently require an authenticated
Goodissima user and do not apply a narrower role gate.

## Safe promotion command

The user must already exist in the Goodissima `User` table. The script never
creates a user and never performs a bulk update.

Preview a production promotion:

```powershell
npx.cmd dotenv -e .env.production -- npm.cmd run admin:promote -- --email user@example.com --role SUPER_ADMIN --confirm-production --dry-run
```

Apply it:

```powershell
npx.cmd dotenv -e .env.production -- npm.cmd run admin:promote -- --email user@example.com --role SUPER_ADMIN --confirm-production
```

The script:

- requires exactly one explicit `--email`;
- rejects unknown, malformed, or repeated command-line arguments;
- rejects wildcards and email lists;
- accepts only `SUPER_ADMIN` or `PRODUCT_OWNER`;
- refuses to run unless `GOODISSIMA_ENV` or `VERCEL_ENV` explicitly identifies
  a supported local, staging, or production environment;
- requires `--confirm-production` when either environment variable identifies
  production;
- requires an explicit `DATABASE_URL`;
- refuses to promote an email absent from the application database;
- is idempotent when the requested role is already assigned;
- records successful role changes in `AuditLog` in the same database transaction.

## Verification

Run the same command with `--dry-run` after promotion and confirm
`previousRole` equals the requested role. Then sign out and back in if an
existing browser session does not immediately display:

- `/administration`
- `/administration/feedback`
- `/ia-valeur`
- `/administration#tests-champagne`

Current authorization sources:

- Feedback produit: `lib/product-feedback.ts`
- Tests Champagne: `lib/champagne-workspace.ts`
- Administration: `app/administration/page.tsx`
- IA & Valeur: `app/admin/ai-costs/page.tsx`
