-- AlterTable
ALTER TABLE "GoodissimaIdentity" ADD COLUMN "relationalSubjectId" TEXT;

-- CreateIndex
CREATE INDEX "GoodissimaIdentity_relationalSubjectId_idx" ON "GoodissimaIdentity"("relationalSubjectId");

-- AddForeignKey
ALTER TABLE "GoodissimaIdentity" ADD CONSTRAINT "GoodissimaIdentity_relationalSubjectId_fkey" FOREIGN KEY ("relationalSubjectId") REFERENCES "RelationalSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
