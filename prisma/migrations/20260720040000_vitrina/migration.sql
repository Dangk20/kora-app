-- CreateEnum
CREATE TYPE "ShowcaseMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ShowcaseRule" AS ENUM ('BEST_SELLERS', 'NEWEST', 'ONLINE_DEAL', 'FEATURED');

-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "slot" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "showcase_sections" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mode" "ShowcaseMode" NOT NULL DEFAULT 'MANUAL',
    "autoRule" "ShowcaseRule" NOT NULL DEFAULT 'NEWEST',
    "limit" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_sections_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "showcase_items" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "showcase_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "showcase_items_sectionKey_position_idx" ON "showcase_items"("sectionKey", "position");

-- CreateIndex
CREATE UNIQUE INDEX "showcase_items_sectionKey_productId_key" ON "showcase_items"("sectionKey", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "banners_slot_key" ON "banners"("slot");

-- CreateIndex
CREATE INDEX "banners_productId_idx" ON "banners"("productId");

-- AddForeignKey
ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_sectionKey_fkey" FOREIGN KEY ("sectionKey") REFERENCES "showcase_sections"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

