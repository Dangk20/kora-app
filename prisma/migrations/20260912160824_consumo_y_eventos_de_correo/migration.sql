-- CreateTable
CREATE TABLE "provider_sends" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "svixId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "to" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_sends_sentAt_idx" ON "provider_sends"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_events_svixId_key" ON "email_events"("svixId");

-- CreateIndex
CREATE INDEX "email_events_providerId_idx" ON "email_events"("providerId");

-- CreateIndex
CREATE INDEX "email_events_type_occurredAt_idx" ON "email_events"("type", "occurredAt");
