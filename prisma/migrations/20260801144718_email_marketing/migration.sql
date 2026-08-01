-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('CHECKOUT', 'MANUAL', 'UNSUBSCRIBE_LINK', 'RESUBSCRIBE', 'SPAM_COMPLAINT', 'BOUNCE');

-- AlterEnum
BEGIN;
CREATE TYPE "RecipientStatus_new" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');
ALTER TABLE "public"."campaign_recipients" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "campaign_recipients" ALTER COLUMN "status" TYPE "RecipientStatus_new" USING ("status"::text::"RecipientStatus_new");
ALTER TYPE "RecipientStatus" RENAME TO "RecipientStatus_old";
ALTER TYPE "RecipientStatus_new" RENAME TO "RecipientStatus";
DROP TYPE "public"."RecipientStatus_old";
ALTER TABLE "campaign_recipients" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "campaign_recipients" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "reservedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "htmlBody",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "ctaUrl" TEXT,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "imageKey" TEXT,
ADD COLUMN     "preheader" TEXT,
ADD COLUMN     "productIds" TEXT[],
ADD COLUMN     "sendStartedAt" TIMESTAMP(3),
ADD COLUMN     "sentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sentHtml" TEXT,
ADD COLUMN     "sentText" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "unsubscribeCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "segment" SET NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "emailUsable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "consent_events" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscribed" BOOLEAN NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_events_customerId_createdAt_idx" ON "consent_events"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaignId_status_idx" ON "campaign_recipients"("campaignId", "status");

-- CreateIndex
CREATE INDEX "campaigns_status_createdAt_idx" ON "campaigns"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

