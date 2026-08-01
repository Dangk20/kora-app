-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "accountActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "accountCreated" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "buyer_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buyer_sessions_tokenHash_key" ON "buyer_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "buyer_sessions_customerId_idx" ON "buyer_sessions"("customerId");

-- CreateIndex
CREATE INDEX "buyer_sessions_expiresAt_idx" ON "buyer_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "buyer_sessions" ADD CONSTRAINT "buyer_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

