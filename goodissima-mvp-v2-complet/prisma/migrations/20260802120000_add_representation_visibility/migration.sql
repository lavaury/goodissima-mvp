CREATE TYPE "RepresentationVisibility" AS ENUM ('PRIVATE', 'DISCOVERABLE');

ALTER TABLE "Representation"
  ADD COLUMN "visibility" "RepresentationVisibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "publishedAt" TIMESTAMP(3);
