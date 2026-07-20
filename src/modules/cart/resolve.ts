// Resolución del carrito en SERVIDOR. El navegador solo aporta variantId+qty;
// producto, precio y disponibilidad se leen aquí, siempre frescos.
//
// El mismo resultado alimenta la vista del carrito, el resumen del checkout y
// el pedido que se crea: un solo cálculo, sin forma de que difieran.
import { db } from "@/lib/db";
import { storage } from "@/modules/storage";
import { resolvePrice, toNumber, type Currency } from "@/modules/pricing";
import type { CartLine } from "./cart-context";

export type ResolvedLine = {
  variantId: string;
  qty: number;
  /** Cantidad realmente pedible: recortada al cupo online disponible. */
  qtyAvailable: number;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  categoryColor: string;
  categoryIcon: string;
  unitPrice: number;
  storeUnitPrice: number;
  hasOnlineDiscount: boolean;
  lineTotal: number;
  onlineUnits: number;
  /** El producto ya no está a la venta o no tiene precio en esta moneda. */
  unavailable: boolean;
};

export type ResolvedCart = {
  lines: ResolvedLine[];
  currency: Currency;
  subtotal: number;
  itemCount: number;
  /** true si algo cambió respecto a lo que el visitante tenía guardado. */
  hasIssues: boolean;
};

export async function resolveCart(
  lines: CartLine[],
  currency: Currency,
): Promise<ResolvedCart> {
  const clean = lines.filter((l) => l.qty > 0);
  if (clean.length === 0) {
    return { lines: [], currency, subtotal: 0, itemCount: 0, hasIssues: false };
  }

  const variants = await db.variant.findMany({
    where: { id: { in: clean.map((l) => l.variantId) } },
    include: {
      product: {
        include: {
          category: true,
          images: { orderBy: { position: "asc" }, take: 1 },
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const driver = storage();

  const resolved: ResolvedLine[] = [];
  for (const line of clean) {
    const variant = byId.get(line.variantId);
    // Variante borrada o desactivada, o producto retirado de la tienda.
    if (!variant || !variant.active || !variant.product.active) continue;

    const price = resolvePrice(
      {
        priceCopStore: toNumber(variant.priceCopStore),
        priceCopOnline: toNumber(variant.priceCopOnline),
        priceUsdStore: toNumber(variant.priceUsdStore),
        priceUsdOnline: toNumber(variant.priceUsdOnline),
      },
      currency,
    );

    const qtyAvailable = Math.max(0, Math.min(line.qty, variant.onlineUnits));
    const image = variant.product.images[0];

    resolved.push({
      variantId: variant.id,
      qty: line.qty,
      qtyAvailable,
      productName: variant.product.name,
      productSlug: variant.product.slug,
      variantName: variant.name,
      sku: variant.sku,
      imageUrl: image ? driver.urlFor(image.url) : null,
      categoryColor: variant.product.category.color,
      categoryIcon: variant.product.category.icon,
      unitPrice: price.amount,
      storeUnitPrice: price.storeAmount,
      hasOnlineDiscount: price.hasOnlineDiscount,
      lineTotal: price.amount * qtyAvailable,
      onlineUnits: variant.onlineUnits,
      unavailable: !price.available || qtyAvailable === 0,
    });
  }

  const subtotal = resolved
    .filter((l) => !l.unavailable)
    .reduce((sum, l) => sum + l.lineTotal, 0);

  return {
    lines: resolved,
    currency,
    subtotal,
    itemCount: resolved
      .filter((l) => !l.unavailable)
      .reduce((sum, l) => sum + l.qtyAvailable, 0),
    hasIssues:
      resolved.length !== clean.length ||
      resolved.some((l) => l.unavailable || l.qtyAvailable !== l.qty),
  };
}
