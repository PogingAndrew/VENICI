/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MessagingPrivacy" AS ENUM ('EVERYONE', 'FOLLOWING', 'MUTUALS', 'NO_ONE');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "messagingPrivacy" "MessagingPrivacy" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");

-- CreateIndex
CREATE INDEX "Profile_username_idx" ON "Profile"("username");
