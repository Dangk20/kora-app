/*
  Warnings:

  - You are about to drop the column `currency` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `coupons` table. All the data in the column will be lost.
  - Added the required column `name` to the `coupons` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'CATEGORIES', 'PRODUCTS');

-- AlterEnum
ALTER TYPE "CouponType" ADD VALUE 'FREE_PRODUCT';

-- AlterTable
ALTER TABLE "coupons" DROP COLUMN "currency",
DROP COLUMN "value",
ADD COLUMN     "amountCop" DECIMAL(12,2),
ADD COLUMN     "amountUsd" DECIMAL(12,2),
ADD COLUMN     "appliesToSaleItems" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "firstPurchaseOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeVariantId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "percentValue" DECIMAL(5,2),
ADD COLUMN     "scope" "CouponScope" NOT NULL DEFAULT 'ALL',
ALTER COLUMN "perCustomerLimit" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "coupon_categories" (
    "couponId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "coupon_categories_pkey" PRIMARY KEY ("couponId","categoryId")
);

-- CreateTable
CREATE TABLE "coupon_products" (
    "couponId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "coupon_products_pkey" PRIMARY KEY ("couponId","productId")
);

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_freeVariantId_fkey" FOREIGN KEY ("freeVariantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_categories" ADD CONSTRAINT "coupon_categories_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_categories" ADD CONSTRAINT "coupon_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
