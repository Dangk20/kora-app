-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CO',
    "state" TEXT,
    "city" TEXT,
    "address" TEXT,
    "address2" TEXT,
    "neighborhood" TEXT,
    "zip" TEXT,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_addresses_customerId_isDefault_idx" ON "customer_addresses"("customerId", "isDefault");

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Cada cliente que YA tenía ciudad o dirección estrena una dirección
-- predeterminada con esos valores. Sin esto, el cambio le borraría de la vista
-- al comprador lo único que había escrito, y el panel se quedaría con una
-- dirección que la libreta no conoce.
--
-- Solo ciudad y dirección: lo que hay hoy es texto libre, sin departamento ni
-- barrio. Se guarda exactamente la información que existía, ni más ni menos;
-- el comprador la completa al editarla.
INSERT INTO "customer_addresses" (
  "id", "customerId", "label", "country", "city", "address", "isDefault", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  'Mi dirección',
  COALESCE(c."country", 'CO'),
  NULLIF(TRIM(c."city"), ''),
  NULLIF(TRIM(c."address"), ''),
  true,
  NOW(),
  NOW()
FROM "customers" c
WHERE NULLIF(TRIM(c."city"), '') IS NOT NULL
   OR NULLIF(TRIM(c."address"), '') IS NOT NULL;
