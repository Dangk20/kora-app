-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cashSessionId" TEXT;

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "register" TEXT NOT NULL DEFAULT 'Caja 1',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT NOT NULL,
    "openingBase" DECIMAL(12,2) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "baseLeft" DECIMAL(12,2),
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_sessions_register_closedAt_idx" ON "cash_sessions"("register", "closedAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un solo turno ABIERTO por caja. Parcial: los cerrados no cuentan.
CREATE UNIQUE INDEX "cash_sessions_one_open_per_register" ON "cash_sessions" ("register") WHERE "closedAt" IS NULL;
