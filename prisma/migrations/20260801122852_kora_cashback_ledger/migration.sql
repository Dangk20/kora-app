-- CreateEnum
CREATE TYPE "CashbackType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST');

-- DropForeignKey
ALTER TABLE "points_movements" DROP CONSTRAINT "points_movements_customerId_fkey";

-- DropForeignKey
ALTER TABLE "points_movements" DROP CONSTRAINT "points_movements_orderId_fkey";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "pointsBalance",
ADD COLUMN     "cashbackCop" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cashbackUsd" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "points_movements";

-- DropEnum
DROP TYPE "PointsReason";

-- CreateTable
CREATE TABLE "cashback_movements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "delta" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "type" "CashbackType" NOT NULL,
    "orderId" TEXT,
    "remaining" DECIMAL(12,2),
    "expiresAt" TIMESTAMP(3),
    "sourceMovementId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashback_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cashback_movements_customerId_currency_createdAt_idx" ON "cashback_movements"("customerId", "currency", "createdAt");

-- CreateIndex
CREATE INDEX "cashback_movements_currency_expiresAt_idx" ON "cashback_movements"("currency", "expiresAt");

-- CreateIndex
CREATE INDEX "cashback_movements_orderId_type_idx" ON "cashback_movements"("orderId", "type");

-- AddForeignKey
ALTER TABLE "cashback_movements" ADD CONSTRAINT "cashback_movements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_movements" ADD CONSTRAINT "cashback_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_movements" ADD CONSTRAINT "cashback_movements_sourceMovementId_fkey" FOREIGN KEY ("sourceMovementId") REFERENCES "cashback_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

