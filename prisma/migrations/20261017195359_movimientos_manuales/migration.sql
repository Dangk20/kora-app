-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('INGRESO', 'EGRESO');

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_sessionId_fkey";

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "kind" "MovementKind" NOT NULL DEFAULT 'EGRESO',
ALTER COLUMN "sessionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
