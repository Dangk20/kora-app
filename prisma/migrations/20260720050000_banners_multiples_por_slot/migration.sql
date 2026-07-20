-- DropIndex
DROP INDEX "banners_slot_key";

-- CreateIndex
CREATE INDEX "banners_slot_position_idx" ON "banners"("slot", "position");

