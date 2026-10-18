-- AlterTable
ALTER TABLE "benefits" ADD COLUMN     "extraCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ruleta_giros" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "premio" TEXT NOT NULL,
    "benefitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruleta_giros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ruleta_giros_customerId_key" ON "ruleta_giros"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ruleta_giros_phone_key" ON "ruleta_giros"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ruleta_giros_benefitId_key" ON "ruleta_giros"("benefitId");

-- CreateIndex
CREATE INDEX "ruleta_giros_premio_idx" ON "ruleta_giros"("premio");

-- AddForeignKey
ALTER TABLE "ruleta_giros" ADD CONSTRAINT "ruleta_giros_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleta_giros" ADD CONSTRAINT "ruleta_giros_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "benefits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
