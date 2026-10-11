-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GA4');

-- CreateTable
CREATE TABLE "order_attributions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "term" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "landing" TEXT,
    "touchAt" TIMESTAMP(3),
    "fbp" TEXT,
    "fbc" TEXT,
    "gaClientId" TEXT,
    "gaSessionId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_conversions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "eventId" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_attributions_orderId_key" ON "order_attributions"("orderId");

-- CreateIndex
CREATE INDEX "order_attributions_source_campaign_idx" ON "order_attributions"("source", "campaign");

-- CreateIndex
CREATE UNIQUE INDEX "ad_conversions_orderId_platform_key" ON "ad_conversions"("orderId", "platform");

-- AddForeignKey
ALTER TABLE "order_attributions" ADD CONSTRAINT "order_attributions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_conversions" ADD CONSTRAINT "ad_conversions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
