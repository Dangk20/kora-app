-- Dirección de facturación y dirección de envío (change direccion-facturacion-y-envio).
-- KORA no envía a EE.UU.: quien paga puede estar en CO o en US; la entrega es
-- siempre en Colombia. El pedido pasa a guardar las dos.

ALTER TABLE "orders"
  ADD COLUMN "billCountry"       TEXT,
  ADD COLUMN "billState"         TEXT,
  ADD COLUMN "billCity"          TEXT,
  ADD COLUMN "billAddress"       TEXT,
  ADD COLUMN "billAddress2"      TEXT,
  ADD COLUMN "billNeighborhood"  TEXT,
  ADD COLUMN "billZip"           TEXT,
  ADD COLUMN "shipSameAsBilling" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shipName"          TEXT,
  ADD COLUMN "shipPhone"         TEXT,
  ADD COLUMN "shipDocument"      TEXT;

-- Backfill: hasta hoy la única dirección del pedido era la del propio
-- comprador, así que todo pedido existente se lee como "misma dirección".
-- Los comprobantes ya emitidos están congelados y no se tocan.
UPDATE "orders" SET
  "billCountry"       = "shipCountry",
  "billState"         = "shipState",
  "billCity"          = "shipCity",
  "billAddress"       = "shipAddress",
  "billAddress2"      = "shipAddress2",
  "billNeighborhood"  = "shipNeighborhood",
  "billZip"           = "shipZip",
  "shipName"          = "contactName",
  "shipPhone"         = "contactPhone",
  "shipDocument"      = "contactDocument",
  "shipSameAsBilling" = true;
