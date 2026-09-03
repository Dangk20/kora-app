-- CreateTable
CREATE TABLE "product_archives" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "hadStock" INTEGER NOT NULL DEFAULT 0,
    "hadOrders" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_archives_createdAt_idx" ON "product_archives"("createdAt");

-- AddForeignKey
ALTER TABLE "product_archives" ADD CONSTRAINT "product_archives_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_archives" ADD CONSTRAINT "product_archives_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
