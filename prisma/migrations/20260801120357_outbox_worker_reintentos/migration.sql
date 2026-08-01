-- AlterTable
ALTER TABLE "domain_events" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "domain_events_status_nextAttemptAt_idx" ON "domain_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "domain_events_status_claimedAt_idx" ON "domain_events"("status", "claimedAt");
