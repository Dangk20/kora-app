-- AlterTable
ALTER TABLE "product_images" ADD COLUMN     "sourceHash" TEXT;

-- CreateIndex
CREATE INDEX "product_images_sourceHash_idx" ON "product_images"("sourceHash");
