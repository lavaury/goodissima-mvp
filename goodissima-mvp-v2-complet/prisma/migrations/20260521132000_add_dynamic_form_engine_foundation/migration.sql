-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "relationTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "defaultValue" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "caseId" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplate_key_key" ON "FormTemplate"("key");

-- CreateIndex
CREATE INDEX "FormField_formTemplateId_position_idx" ON "FormField"("formTemplateId", "position");

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RelationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default dynamic form template for the existing secure conversation template.
INSERT INTO "FormTemplate" ("id", "key", "name", "description", "relationTemplateId", "updatedAt")
SELECT
    'form_tpl_default_secure_conversation',
    'DEFAULT_SECURE_CONVERSATION_FORM',
    'Formulaire de conversation securisee',
    'Formulaire par defaut pour initier une conversation securisee.',
    "id",
    CURRENT_TIMESTAMP
FROM "RelationTemplate"
WHERE "key" = 'DEFAULT_SECURE_CONVERSATION'
ON CONFLICT ("key") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "relationTemplateId" = EXCLUDED."relationTemplateId",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "FormField" ("id", "formTemplateId", "key", "label", "type", "required", "placeholder", "position", "updatedAt")
SELECT
    'form_field_default_full_name',
    "id",
    'fullName',
    'Nom complet',
    'text',
    true,
    'Votre nom',
    10,
    CURRENT_TIMESTAMP
FROM "FormTemplate"
WHERE "key" = 'DEFAULT_SECURE_CONVERSATION_FORM'
  AND NOT EXISTS (
    SELECT 1 FROM "FormField"
    WHERE "formTemplateId" = "FormTemplate"."id" AND "key" = 'fullName'
  );

INSERT INTO "FormField" ("id", "formTemplateId", "key", "label", "type", "required", "placeholder", "position", "updatedAt")
SELECT
    'form_field_default_email',
    "id",
    'email',
    'Email',
    'email',
    true,
    'Votre email',
    20,
    CURRENT_TIMESTAMP
FROM "FormTemplate"
WHERE "key" = 'DEFAULT_SECURE_CONVERSATION_FORM'
  AND NOT EXISTS (
    SELECT 1 FROM "FormField"
    WHERE "formTemplateId" = "FormTemplate"."id" AND "key" = 'email'
  );

INSERT INTO "FormField" ("id", "formTemplateId", "key", "label", "type", "required", "placeholder", "position", "updatedAt")
SELECT
    'form_field_default_message',
    "id",
    'message',
    'Message',
    'textarea',
    true,
    'Presentez-vous et indiquez votre demande',
    30,
    CURRENT_TIMESTAMP
FROM "FormTemplate"
WHERE "key" = 'DEFAULT_SECURE_CONVERSATION_FORM'
  AND NOT EXISTS (
    SELECT 1 FROM "FormField"
    WHERE "formTemplateId" = "FormTemplate"."id" AND "key" = 'message'
  );
