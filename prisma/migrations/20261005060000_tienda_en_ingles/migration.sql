-- Tienda en inglés (change `tienda-en-ingles`): versión en inglés opcional del
-- contenido de catálogo. Aditiva; vacía = se muestra el español.


-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "nameEn" TEXT;

