-- CreateEnum
CREATE TYPE "OrderEmailType" AS ENUM ('BUYER_CREATED', 'BUYER_CONFIRMED', 'BUYER_SHIPPED', 'BUYER_CANCELLED', 'STAFF_NEW_ORDER');

-- CreateTable
CREATE TABLE "order_emails" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderEmailType" NOT NULL,
    "to" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_emails_sentAt_idx" ON "order_emails"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_emails_orderId_type_key" ON "order_emails"("orderId", "type");

-- AddForeignKey
ALTER TABLE "order_emails" ADD CONSTRAINT "order_emails_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

