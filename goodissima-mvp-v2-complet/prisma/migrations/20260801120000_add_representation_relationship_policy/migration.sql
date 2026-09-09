CREATE TYPE "RepresentationRelationshipPolicy" AS ENUM ('OPEN', 'MESSAGE_ONLY', 'CLOSED');

ALTER TABLE "Representation"
  ADD COLUMN "relationshipPolicy" "RepresentationRelationshipPolicy" NOT NULL DEFAULT 'OPEN';
