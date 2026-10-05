-- Vitrina: una sección manual admite productos sueltos O categorías enteras
-- (change `vitrina-por-categoria`). Aditiva: los elementos existentes son de
-- producto y siguen siéndolo.

-- AlterTable
ALTER TABLE "showcase_items" ADD COLUMN     "categoryId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- Exactamente uno de los dos. Sin esto, un elemento sin nada que mostrar
-- (o con los dos) pasaría por válido y la sección lo ignoraría sin avisar.
ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_producto_o_categoria"
  CHECK (("productId" IS NULL) <> ("categoryId" IS NULL));

-- CreateIndex
CREATE UNIQUE INDEX "showcase_items_sectionKey_categoryId_key" ON "showcase_items"("sectionKey", "categoryId");

-- AddForeignKey
ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
