-- CreateEnum
CREATE TYPE "BenefitKind" AS ENUM ('CASHBACK', 'DESCUENTO_CATEGORIA', 'PRODUCTO_GRATIS');

-- CreateEnum
CREATE TYPE "BenefitSource" AS ENUM ('RULETA', 'MANUAL');

-- CreateTable
CREATE TABLE "benefits" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "BenefitKind" NOT NULL,
    "source" "BenefitSource" NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "categoryId" TEXT,
    "variantId" TEXT,
    "cashbackMovementId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedOrderId" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "benefits_cashbackMovementId_key" ON "benefits"("cashbackMovementId");

-- CreateIndex
CREATE INDEX "benefits_customerId_expiresAt_idx" ON "benefits"("customerId", "expiresAt");

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_cashbackMovementId_fkey" FOREIGN KEY ("cashbackMovementId") REFERENCES "cashback_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_usedOrderId_fkey" FOREIGN KEY ("usedOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
