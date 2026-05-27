-- Enable RLS on application tables that are not accessed directly from the browser.
-- No policies are added: Supabase anon/authenticated clients remain denied by default.
-- Do not FORCE RLS so server-side Prisma access through DATABASE_URL is preserved.
ALTER TABLE "AIEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmbeddingJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RelationAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RelationEmbedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RelationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RelationTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TemplateVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserNotificationPreference" ENABLE ROW LEVEL SECURITY;
