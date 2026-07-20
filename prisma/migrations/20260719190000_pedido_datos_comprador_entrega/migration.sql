-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "checkoutToken" TEXT,
ADD COLUMN     "contactDocument" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "paymentPreference" TEXT,
ADD COLUMN     "shipAddress" TEXT,
ADD COLUMN     "shipAddress2" TEXT,
ADD COLUMN     "shipCity" TEXT,
ADD COLUMN     "shipCountry" TEXT DEFAULT 'CO',
ADD COLUMN     "shipNeighborhood" TEXT,
ADD COLUMN     "shipNotes" TEXT,
ADD COLUMN     "shipState" TEXT,
ADD COLUMN     "shipZip" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_checkoutToken_key" ON "orders"("checkoutToken");

