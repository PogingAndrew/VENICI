/*
  Warnings:

  - You are about to drop the column `age` on the `Profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "age",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Food_createdByUserId_idx" ON "Food"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
