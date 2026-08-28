-- Compra mínima del cupón: de una columna muerta a dos importes reales.
--
-- `minSubtotal` existía en el esquema y NADIE la leía ni la escribía: ni el
-- canje, ni el panel, ni una prueba. Aparentaba tener hecho el requisito que el
-- cliente pidió el 7 ago 2026 e inducía a construirlo mal, porque era UN solo
-- importe: COP y USD no se convierten en este sistema, así que un mínimo único
-- obligaría a inventar una tasa de cambio que no existe.
--
-- EL BORRADO NO PIERDE NADA. Comprobado el 27 ago 2026 en los dos entornos
-- antes de escribir esto:
--   pruebas    → 0 filas con minSubtotal no nulo
--   producción → 0 cupones en total
-- Si alguna vez hubiera datos, este DROP tendría que ser un traspaso a
-- minSubtotalCop, no un borrado.

/*
  Warnings:

  - You are about to drop the column `minSubtotal` on the `coupons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "coupons" DROP COLUMN "minSubtotal",
ADD COLUMN     "minSubtotalCop" DECIMAL(12,2),
ADD COLUMN     "minSubtotalUsd" DECIMAL(12,2);
