-- AlterTable
ALTER TABLE "User" ADD COLUMN "goodissimaIdentityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_goodissimaIdentityId_key" ON "User"("goodissimaIdentityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_goodissimaIdentityId_fkey" FOREIGN KEY ("goodissimaIdentityId") REFERENCES "GoodissimaIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
