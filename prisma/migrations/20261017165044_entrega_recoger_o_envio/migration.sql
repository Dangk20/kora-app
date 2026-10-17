-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('SHIPPING', 'PICKUP');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'SHIPPING';
