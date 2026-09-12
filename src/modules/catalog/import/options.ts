// Opciones (Talla → M) para variantes que entraron sin grupos.
//
// El importador de plantilla crea la variante con su nombre ("Talla M") pero
// no el grupo de opción ni su valor: eso lo hace el alta del panel. Un
// producto así en el panel aparece con las variantes "apagadas" y sin talla
// visible (lo vio Daniel con el catálogo real, 12 sep 2026). Esta función
// completa lo que falta, y es IDEMPOTENTE: correrla otra vez no crea nada.

import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export async function ensureVariantOption(
  tx: Tx,
  variantId: string,
  optionName: string,
  value: string,
): Promise<{ created: boolean }> {
  const variante = await tx.variant.findUnique({
    where: { id: variantId },
    select: { productId: true, optionValues: { select: { valueId: true } } },
  });
  if (!variante) return { created: false };

  const opcion = await tx.productOption.upsert({
    where: { productId_name: { productId: variante.productId, name: optionName } },
    create: { productId: variante.productId, name: optionName, position: 0 },
    update: {},
    select: { id: true },
  });
  const cuantos = await tx.productOptionValue.count({ where: { optionId: opcion.id } });
  const valor = await tx.productOptionValue.upsert({
    where: { optionId_value: { optionId: opcion.id, value } },
    create: { optionId: opcion.id, value, position: cuantos },
    update: {},
    select: { id: true },
  });

  if (variante.optionValues.some((v) => v.valueId === valor.id)) return { created: false };
  await tx.variantOptionValue.create({ data: { variantId, valueId: valor.id } });
  return { created: true };
}
