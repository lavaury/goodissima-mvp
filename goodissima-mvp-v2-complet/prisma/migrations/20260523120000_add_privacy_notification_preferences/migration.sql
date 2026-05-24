-- Privacy-first notification preferences are explicit opt-in only.
ALTER TABLE "RelationCase"
ADD COLUMN "candidateEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "newMessagesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "newRequestsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "newDocumentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "validationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "relationalPrivacyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pseudonymizationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserNotificationPreference_userId_key" ON "UserNotificationPreference"("userId");

ALTER TABLE "UserNotificationPreference"
ADD CONSTRAINT "UserNotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
