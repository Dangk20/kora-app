// La venta de mostrador (change s09-pos-caja, S9). Una sola transacción:
// pedido POS + descuento del inventario unificado + comprobante congelado.
//
// Sin sesión a propósito: la acción `cobrarVentaPos` (actions.ts) exige el
// permiso y llama aquí. Así la prueba de concurrencia cruzada web + POS
// ejercita el código real, no una imitación.
import { z } from "zod";
import { db } from "@/lib/db";
import { applyStockMovement, StockError } from "@/modules/inventory/engine";
import { freezeSalesDocument } from "@/modules/invoicing/document";
import { formatOrderNumber } from "@/modules/orders/message";
import { resolvePrice } from "@/modules/pricing";
import { normalizarTelefono } from "@/modules/customers/phone";
import { BeneficioNoDisponible, tomarBeneficio } from "@/modules/benefits/benefits";
import { creditCashback } from "@/modules/cashback/ledger";
import { computeAccrual } from "@/modules/cashback/accrual";
import { resolverClienteVenta } from "./customers";
import { CAJA } from "./turno";

/** Métodos de cobro en caja. El valor se guarda tal cual en `paymentPreference`. */
// Nequi es una transferencia más (decisión de Daniel, 17 oct 2026): un solo botón.
export const POS_PAYMENT_METHODS = ["Efectivo", "Datáfono", "Transferencia"] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

const ventaSchema = z.object({
  // Solo variante y cantidad: el precio NUNCA viene del navegador.
  lines: z
    .array(z.object({ variantId: z.string().min(1), qty: z.number().int().min(1).max(999) }))
    .min(1, "El ticket está vacío"),
  method: z.enum(POS_PAYMENT_METHODS, { error: "Elige el método de pago" }),
  /** Con efectivo: lo que entregó el cliente. */
  cashReceived: z.number().nonnegative().optional(),
  /**
   * Opcional: sin él, el recibo sale a "Consumidor final". Con él, la venta se
   * ata al cliente (o lo CREA con origen POS) y aparece en el Módulo de clientes.
   */
  customer: z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(3, "Escribe el nombre del cliente").max(120),
      phone: z.string().trim().refine((v) => normalizarTelefono(v) !== null, "El celular (WhatsApp) no es válido"),
      document: z.string().trim().max(40).optional(),
      email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
    })
    .optional(),
  /**
   * Beneficio que el cliente canjea en esta compra (change beneficios): un
   * descuento por categoría o un producto de regalo. Exige `customer.id`.
   */
  benefitId: z.string().min(1).optional(),
});

export type VentaPosInput = z.input<typeof ventaSchema>;

export type VentaPosResult =
  | { ok: true; orderId: string; orderNumber: string; total: number; change: number; discount: number; cashback: number }
  | { ok: false; error: string };

const num = (d: { toString(): string }) => Number(d.toString());

class CajaCerrada extends Error {
  constructor() {
    super("CAJA_CERRADA");
  }
}

class FaltaStock extends Error {
  constructor(public readonly producto: string, public readonly disponible: number) {
    super("FALTA_STOCK");
  }
}

/** `register` solo lo cambian las pruebas (su propia caja); la acción usa la de siempre. */
export async function registrarVentaPos(input: unknown, actorId: string, register = CAJA): Promise<VentaPosResult> {
  const parsed = ventaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const armado = await armarLineas(data.lines);
  if (!armado.ok) return armado;
  const lineas = armado.lineas;

  const subtotal = lineas.reduce((s, l) => s + l.total, 0);

  // El beneficio se lee aquí para saber cuánto cobrar; dentro de la
  // transacción se vuelve a tomar CON BLOQUEO (tomarBeneficio) y ahí se valida
  // que siga vigente y sea de este cliente.
  let discount = 0;
  if (data.benefitId) {
    if (!data.customer?.id) return { ok: false, error: "Busca al cliente para usar su beneficio" };
    const b = await db.benefit.findUnique({
      where: { id: data.benefitId },
      select: { kind: true, amount: true, categoryId: true, extraCategoryIds: true, variantId: true, title: true, category: { select: { name: true } } },
    });
    if (!b) return { ok: false, error: "El beneficio no existe" };
    const r = descuentoDeBeneficio(b, lineas);
    if (!r.ok) return r;
    discount = r.discount;
  }
  const total = subtotal - discount;
  let change = 0;
  if (data.method === "Efectivo") {
    const recibido = data.cashReceived ?? 0;
    if (recibido < total) return { ok: false, error: "El efectivo recibido no alcanza para el total" };
    change = recibido - total;
  }

  const nota =
    data.method === "Efectivo"
      ? `Venta en caja · Efectivo · recibido ${data.cashReceived} · vueltas ${change}`
      : `Venta en caja · ${data.method}`;

  try {
    const order = await db.$transaction(
      async (tx) => {
        // Sin turno abierto no se vende. FOR SHARE: varias ventas a la vez no
        // se estorban, pero un cierre (FOR UPDATE) espera a que terminen y
        // ninguna venta queda fuera del resumen del turno que se está cerrando.
        const turno = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM cash_sessions WHERE register = ${register} AND "closedAt" IS NULL FOR SHARE
        `;
        if (turno.length === 0) throw new CajaCerrada();

        // UN instante para todo el acto: cobro, entrega y comprobante.
        const ahora = new Date();
        const cliente = data.customer ? await resolverClienteVenta(tx, data.customer) : null;
        const creado = await tx.order.create({
          data: {
            channel: "POS",
            cashSessionId: turno[0].id,
            // En mostrador el cliente se lleva el producto en el mismo acto.
            status: "DELIVERED",
            currency: "COP",
            subtotal,
            discountTotal: discount,
            cashbackApplied: 0,
            total,
            customerId: cliente?.id ?? null,
            contactName: cliente?.name ?? null,
            contactPhone: cliente?.phone ?? null,
            contactEmail: cliente?.email ?? null,
            contactDocument: cliente?.document ?? null,
            paymentPreference: data.method,
            note: nota,
            confirmedAt: ahora,
            confirmedById: actorId,
            // ⚠️ Las líneas NO van aquí. Insertar un `order_item` toma un
            // bloqueo compartido (FOR KEY SHARE, por la llave foránea) sobre
            // la fila de la variante; si se escribe ANTES del FOR UPDATE del
            // motor, dos ventas simultáneas de la misma unidad se quedan con
            // el compartido cada una y se esperan mutuamente para subirlo a
            // exclusivo: deadlock. Lo encontró la prueba de concurrencia
            // cruzada (17 oct 2026). Primero el motor toma la fila; las líneas
            // se escriben después.
            statusHistory: {
              create: { from: "PENDING", to: "DELIVERED", actorId, note: "Venta en caja (POS)" },
            },
          },
        });

        for (const l of lineas) {
          try {
            await applyStockMovement(tx, {
              variantId: l.variantId,
              delta: -l.qty,
              reason: "VENTA_POS",
              channel: "POS",
              orderId: creado.id,
              actorId,
              note: "Venta en caja",
            });
          } catch (e) {
            if (e instanceof StockError && e.code === "INSUFFICIENT") {
              throw new FaltaStock(l.productName, e.available ?? 0);
            }
            throw e;
          }
        }

        await tx.orderItem.createMany({
          data: lineas.map((l) => ({
            orderId: creado.id,
            variantId: l.variantId,
            qty: l.qty,
            unitPrice: l.unitPrice,
            total: l.total,
            productName: l.productName,
            variantName: l.variantName,
            sku: l.sku,
          })),
        });

        if (data.benefitId) {
          if (!cliente) throw new BeneficioNoDisponible("Busca al cliente para usar su beneficio");
          await tomarBeneficio(tx, data.benefitId, cliente.id, ahora);
          await tx.benefit.update({ where: { id: data.benefitId }, data: { usedAt: ahora, usedOrderId: creado.id } });
        }

        // Kora Cashback: en caja también acumula el 3 % si la venta se ata a un
        // cliente (reglas del cliente). Se acredita aquí, en la misma
        // transacción, porque la venta POS no emite `order.confirmed`.
        const cashback = cliente ? computeAccrual({ total, currency: "COP" }) : 0;
        if (cliente && cashback > 0) {
          await creditCashback(tx, { customerId: cliente.id, amount: cashback, currency: "COP", orderId: creado.id, now: ahora });
        }

        // El comprobante se congela DENTRO de la transacción, como en
        // `confirmOrder`: una venta sin comprobante no da ningún error.
        await freezeSalesDocument(tx, creado.id, ahora);
        // Sin `order.confirmed` a propósito: dispararía correo al comprador,
        // cashback (ya acreditado arriba) y la compra a Meta/GA4 (design.md §3).
        return { ...creado, cashback };
      },
      { timeout: 30_000, maxWait: 30_000 },
    );

    return {
      ok: true,
      orderId: order.id,
      orderNumber: formatOrderNumber(order.number, order.createdAt),
      total,
      change,
      discount,
      cashback: order.cashback,
    };
  } catch (e) {
    if (e instanceof CajaCerrada) {
      return { ok: false, error: "La caja está cerrada. Ábrela para empezar a vender." };
    }
    if (e instanceof BeneficioNoDisponible) return { ok: false, error: e.motivo };
    if (e instanceof FaltaStock) {
      return {
        ok: false,
        error: `No hay suficiente ${e.producto}: quedan ${e.disponible}. No se descontó nada.`,
      };
    }
    console.error("[pos] no se pudo registrar la venta", e);
    return { ok: false, error: "No se pudo registrar la venta. Intenta de nuevo." };
  }
}

/** `categorias`: la del producto y sus ancestros (hasta dos niveles arriba). */
type LineaBeneficio = { variantId: string; categorias: string[]; unitPrice: number; total: number };

/**
 * Cuánto descuenta un beneficio sobre el ticket.
 *  - DESCUENTO_CATEGORIA: el % sobre las líneas de esa categoría.
 *  - PRODUCTO_GRATIS: UNA unidad del producto de regalo, que debe estar en el
 *    ticket (así sale del inventario por el motor, como cualquier venta).
 */
export function descuentoDeBeneficio(
  b: {
    kind: string; amount: { toString(): string } | number | null; categoryId: string | null;
    extraCategoryIds?: string[]; variantId: string | null; category?: { name: string } | null;
  },
  lineas: LineaBeneficio[],
): { ok: true; discount: number } | { ok: false; error: string } {
  if (b.kind === "DESCUENTO_CATEGORIA") {
    // Cada categoría del beneficio cubre también sus subcategorías.
    const cubre = new Set([b.categoryId, ...(b.extraCategoryIds ?? [])].filter(Boolean));
    const base = lineas
      .filter((l) => l.categorias.some((c) => cubre.has(c)))
      .reduce((s, l) => s + l.total, 0);
    if (base <= 0) return { ok: false, error: `Agrega al ticket un producto de ${b.category?.name ?? "la categoría del beneficio"}` };
    const pct = Number(b.amount?.toString() ?? 0);
    return { ok: true, discount: Math.floor((base * pct) / 100) };
  }
  if (b.kind === "PRODUCTO_GRATIS") {
    const l = lineas.find((x) => x.variantId === b.variantId);
    if (!l) return { ok: false, error: "Agrega al ticket el producto de regalo" };
    return { ok: true, discount: l.unitPrice };
  }
  return { ok: false, error: "El cashback de regalo se usa como saldo, no como beneficio de caja" };
}

/**
 * Las líneas del ticket con el precio de TIENDA resuelto en el servidor.
 * La usan el cobro y la vista previa del beneficio (mismo número en los dos).
 */
async function armarLineas(lines: { variantId: string; qty: number }[]) {
  // La misma variante dos veces en el ticket es una sola línea.
  const cantidades = new Map<string, number>();
  for (const l of lines) cantidades.set(l.variantId, (cantidades.get(l.variantId) ?? 0) + l.qty);

  const variantes = await db.variant.findMany({
    where: { id: { in: [...cantidades.keys()] }, active: true, product: { active: true, archivedAt: null } },
    select: {
      id: true,
      sku: true,
      name: true,
      priceCopStore: true,
      priceCopOnline: true,
      priceUsdStore: true,
      priceUsdOnline: true,
      product: {
        select: {
          name: true,
          categoryId: true,
          category: { select: { parentId: true, parent: { select: { parentId: true } } } },
        },
      },
    },
  });
  if (variantes.length !== cantidades.size) {
    return { ok: false as const, error: "Un producto del ticket ya no está disponible. Quítalo y vuelve a intentar." };
  }

  // Precio de TIENDA en COP, resuelto aquí: el único que cobra el POS.
  const lineas = variantes
    .map((v) => {
      const precio = resolvePrice(
        {
          priceCopStore: num(v.priceCopStore),
          priceCopOnline: num(v.priceCopOnline),
          priceUsdStore: num(v.priceUsdStore),
          priceUsdOnline: num(v.priceUsdOnline),
        },
        "COP",
        "store",
      ).amount;
      const qty = cantidades.get(v.id)!;
      return {
        variantId: v.id, sku: v.sku, productName: v.product.name, variantName: v.name,
        categorias: [v.product.categoryId, v.product.category.parentId, v.product.category.parent?.parentId].filter(
          (c): c is string => Boolean(c),
        ),
        qty, unitPrice: precio, total: precio * qty,
      };
    })
    // Orden estable: dos ventas con ítems cruzados no se bloquean entre sí.
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  const sinPrecio = lineas.find((l) => !(l.unitPrice > 0));
  if (sinPrecio) return { ok: false as const, error: `${sinPrecio.productName} no tiene precio de tienda` };
  return { ok: true as const, lineas };
}

/** Vista previa del cobro: cuánto descuenta el beneficio sobre este ticket. */
export async function previsualizarBeneficio(
  benefitId: string,
  lines: { variantId: string; qty: number }[],
): Promise<{ ok: true; discount: number } | { ok: false; error: string }> {
  const armado = await armarLineas(lines);
  if (!armado.ok) return armado;
  const b = await db.benefit.findUnique({
    where: { id: benefitId },
    select: { kind: true, amount: true, categoryId: true, extraCategoryIds: true, variantId: true, category: { select: { name: true } } },
  });
  if (!b) return { ok: false, error: "El beneficio no existe" };
  return descuentoDeBeneficio(b, armado.lineas);
}
