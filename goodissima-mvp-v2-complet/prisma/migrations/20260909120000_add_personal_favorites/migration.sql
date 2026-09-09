-- CreateEnum
CREATE TYPE "FavoriteObjectKind" AS ENUM ('PORTFOLIO', 'WORKSPACE', 'GLINK', 'RELATION_TEMPLATE', 'RELATION_CASE');

-- CreateTable
CREATE TABLE "PersonalFavorite" (
    "userId" TEXT NOT NULL,
    "objectKind" "FavoriteObjectKind" NOT NULL,
    "objectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalFavorite_pkey" PRIMARY KEY ("userId","objectKind","objectId")
);

-- CreateIndex
CREATE INDEX "PersonalFavorite_userId_createdAt_idx" ON "PersonalFavorite"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PersonalFavorite" ADD CONSTRAINT "PersonalFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
