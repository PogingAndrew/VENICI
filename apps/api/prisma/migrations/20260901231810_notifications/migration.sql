-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastReadByA" TIMESTAMP(3),
ADD COLUMN     "lastReadByB" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "notificationsLastCheckedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
