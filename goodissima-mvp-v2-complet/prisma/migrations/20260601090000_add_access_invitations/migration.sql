CREATE TYPE "AccessInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "AccessInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "status" "AccessInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "token" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessInvitation_email_key" ON "AccessInvitation"("email");
CREATE INDEX "AccessInvitation_status_createdAt_idx" ON "AccessInvitation"("status", "createdAt");
