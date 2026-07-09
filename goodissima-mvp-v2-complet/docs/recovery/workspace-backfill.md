# Governance Workspace Backfill

Sprint 8S introduces the persistent `Workspace` model. Existing governed journeys created before this migration may still have workspace information only inside `TemplateVersion.snapshot.metadata`.

Run the backfill after applying the Prisma migration:

```bash
node --experimental-strip-types scripts/backfill-governance-workspaces.ts
```

The script only reads existing governed journey template versions with `snapshot.metadata.source === "governance-v1-minimal-create"`. For each version, it uses `metadata.createdById` to create or reuse an owner-scoped Workspace, attaches the `RelationTemplate` when it is not already attached, and updates the snapshot metadata to `workspacePersistence: "prisma-workspace-v1-backfilled"`.

It does not create demo data, send email, create invitations, generate tokens, open access, or start workflows.
