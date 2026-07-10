-- Discovery Context Model V1.
-- Adds contextual discovery without changing request, relation, channel or governance state machines.

CREATE TYPE "GoodissimaDiscoveryContextStatus" AS ENUM ('Active', 'Suspended', 'Invisible');

CREATE TABLE "goodissima_discovery_contexts" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "state" "GoodissimaDiscoveryContextStatus" NOT NULL,
  "conditions" TEXT[],
  "requestedChannels" "GoodissimaChannelType"[],
  "trustContext" TEXT[],
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goodissima_discovery_contexts_pkey" PRIMARY KEY ("id")
);

INSERT INTO "goodissima_discovery_contexts" (
  "id",
  "name",
  "description",
  "state",
  "conditions",
  "requestedChannels",
  "trustContext",
  "displayOrder",
  "updatedAt"
) VALUES
  (
    'context-recrutement',
    'Recrutement',
    'Etre decouvert pour des opportunites de recrutement qualifiees.',
    'Active',
    ARRAY['Organisation verifiee', 'Motif obligatoire'],
    ARRAY['Message', 'Documents']::"GoodissimaChannelType"[],
    ARRAY['Organisation verifiee', 'Email verifie'],
    1,
    CURRENT_TIMESTAMP
  ),
  (
    'context-conseil',
    'Conseil',
    'Echanger pour des missions de conseil ou d''expertise.',
    'Active',
    ARRAY['Compte Goodissima', 'Motif obligatoire'],
    ARRAY['Message', 'Appel audio', 'Documents']::"GoodissimaChannelType"[],
    ARRAY['Identite verifiee', 'Membre Goodissima'],
    2,
    CURRENT_TIMESTAMP
  ),
  (
    'context-conferences',
    'Conferences',
    'Recevoir des invitations a intervenir ou participer a un evenement.',
    'Active',
    ARRAY['Motif obligatoire', 'Contexte evenementiel'],
    ARRAY['Message', 'Visio']::"GoodissimaChannelType"[],
    ARRAY['Compte Goodissima', 'Motif fourni'],
    3,
    CURRENT_TIMESTAMP
  ),
  (
    'context-presse',
    'Presse',
    'Permettre les demandes journalistiques sans publier de coordonnees.',
    'Invisible',
    ARRAY['Motif obligatoire'],
    ARRAY['Message']::"GoodissimaChannelType"[],
    ARRAY['Compte Goodissima'],
    4,
    CURRENT_TIMESTAMP
  );

ALTER TABLE "goodissima_profiles"
  ADD COLUMN "identityId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "discoveryContextId" TEXT NOT NULL DEFAULT 'context-conseil';

ALTER TABLE "goodissima_requests"
  ADD COLUMN "discoveryContextId" TEXT NOT NULL DEFAULT 'context-conseil',
  ADD COLUMN "discoveryContextName" TEXT NOT NULL DEFAULT 'Conseil';

ALTER TABLE "goodissima_relations"
  ADD COLUMN "discoveryContextId" TEXT NOT NULL DEFAULT 'context-conseil',
  ADD COLUMN "discoveryContextName" TEXT NOT NULL DEFAULT 'Conseil';

ALTER TABLE "goodissima_history_events"
  ADD COLUMN "discoveryContextId" TEXT;

CREATE INDEX "goodissima_discovery_contexts_state_idx" ON "goodissima_discovery_contexts"("state");
CREATE INDEX "goodissima_discovery_contexts_displayOrder_idx" ON "goodissima_discovery_contexts"("displayOrder");
CREATE INDEX "goodissima_profiles_discoveryContextId_idx" ON "goodissima_profiles"("discoveryContextId");
CREATE INDEX "goodissima_profiles_identityId_idx" ON "goodissima_profiles"("identityId");
CREATE INDEX "goodissima_requests_discoveryContextId_idx" ON "goodissima_requests"("discoveryContextId");
CREATE INDEX "goodissima_relations_discoveryContextId_idx" ON "goodissima_relations"("discoveryContextId");
CREATE INDEX "goodissima_history_events_discoveryContextId_idx" ON "goodissima_history_events"("discoveryContextId");

ALTER TABLE "goodissima_profiles"
  ADD CONSTRAINT "goodissima_profiles_discoveryContextId_fkey"
  FOREIGN KEY ("discoveryContextId") REFERENCES "goodissima_discovery_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goodissima_requests"
  ADD CONSTRAINT "goodissima_requests_discoveryContextId_fkey"
  FOREIGN KEY ("discoveryContextId") REFERENCES "goodissima_discovery_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goodissima_relations"
  ADD CONSTRAINT "goodissima_relations_discoveryContextId_fkey"
  FOREIGN KEY ("discoveryContextId") REFERENCES "goodissima_discovery_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goodissima_history_events"
  ADD CONSTRAINT "goodissima_history_events_discoveryContextId_fkey"
  FOREIGN KEY ("discoveryContextId") REFERENCES "goodissima_discovery_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
