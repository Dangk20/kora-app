"use server";

// Creación del pedido (PED_HU002). Reglas que este archivo garantiza:
//   - Los precios se resuelven AQUÍ, en servidor; nada de lo que mande el
//     navegador fija un precio.
//   - NO se descuenta ni reserva stock (decisión cerrada: el stock se mueve
//     solo al confirmar, PED_HU004).
//   - Idempotencia: doble clic no crea dos pedidos (checkoutToken único).
//   - Pedido + ítems se escriben en una sola transacción.
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { activeCurrency } from "@/modules/pricing/currency";
import { resolveCart } from "@/modules/cart/resolve";
import type { CartLine } from "@/modules/cart/cart-context";
import {
  buildWhatsappMessage,
  compactAddress,
  formatOrderNumber,
  whatsappUrl,
} from "./message";
import { whatsappNumberFor } from "./settings";
import { toE164 } from "@/modules/customers/phone";
import { currentBuyer } from "@/modules/buyer/session-cookie";
import { resolveOrderCustomer } from "./customer-link";
import { validateCoupon } from "@/modules/coupons/validate";

/**
 * El cupón se agotó o se pausó entre validarlo y crear el pedido.
 *
 * Se lanza DENTRO de la transacción para que se deshaga entera: si el cupón ya
 * no está disponible, el pedido no debe existir con un descuento que nadie
 * autorizó.
 */
class CouponRaceError extends Error {
  constructor() {
    super("Este cupón ya alcanzó su límite de usos.");
    this.name = "CouponRaceError";
  }
}

/** Validez del pedido pendiente (PED_HU003). */
const ORDER_TTL_MS = 2 * 60 * 60 * 1000;

const baseSchema = z.object({
  checkoutToken: z.string().min(10).max(100),
  // El descuento NUNCA viene del navegador: solo el código. Quien calcula es
  // quien crea el pedido.
  couponCode: z.string().trim().toUpperCase().optional().or(z.literal("").transform(() => undefined)),
  country: z.enum(["CO", "US"]),
  name: z.string().trim().min(3, "Escribe tu nombre completo"),
  email: z.string().trim().email("Correo inválido"),
  phone: z.string().trim().min(7, "Teléfono inválido"),
  address: z.string().trim().min(5, "Escribe la dirección"),
  address2: z.string().trim().optional(),
  city: z.string().trim().min(2, "Escribe la ciudad"),
  state: z.string().trim().min(2, "Selecciona el departamento o estado"),
  neighborhood: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  document: z.string().trim().optional(),
  documentType: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
  paymentPreference: z.string().trim().min(2, "Elige un método de pago"),
  acceptsData: z.literal(true, { error: "Debes aceptar el tratamiento de datos" }),
  acceptsMarketing: z.boolean().default(false),
});

export type CheckoutResult =
  | { ok: true; orderNumber: string; whatsappUrl: string }
  | { ok: false; error: string; field?: string };

type OrderRow = {
  number: number;
  createdAt: Date;
  currency: "COP" | "USD";
  whatsappMessage: string | null;
};

/** Respuesta a partir de un pedido ya persistido (nuevo o recuperado). */
async function orderResult(order: OrderRow): Promise<CheckoutResult> {
  const orderNumber = formatOrderNumber(order.number, order.createdAt);
  return {
    ok: true,
    orderNumber,
    whatsappUrl: whatsappUrl(
      await whatsappNumberFor(order.currency),
      order.whatsappMessage ?? `Hola KORA 👋, quiero confirmar mi pedido ${orderNumber}`,
    ),
  };
}

export async function createOrder(
  lines: CartLine[],
  form: unknown,
): Promise<CheckoutResult> {
  const parsed = baseSchema.safeParse(form);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const data = parsed.data;

  // Validaciones propias de cada país (PED_HU001 §2/§3).
  if (data.country === "CO") {
    if (!data.document || data.document.replace(/\D/g, "").length < 5) {
      return { ok: false, error: "Escribe tu número de documento", field: "document" };
    }
    if (!data.neighborhood) {
      return { ok: false, error: "Escribe el barrio", field: "neighborhood" };
    }
    if (data.phone.replace(/\D/g, "").replace(/^57/, "").length !== 10) {
      return { ok: false, error: "El celular debe tener 10 dígitos", field: "phone" };
    }
  } else if (!/^\d{5}(-\d{4})?$/.test(data.zip ?? "")) {
    return { ok: false, error: "ZIP inválido (##### o #####-####)", field: "zip" };
  }

  // Idempotencia: si este token ya creó un pedido, se devuelve el mismo.
  const existing = await db.order.findUnique({
    where: { checkoutToken: data.checkoutToken },
  });
  if (existing) return orderResult(existing);

  const currency = await activeCurrency();
  const cart = await resolveCart(lines, currency);
  const buyable = cart.lines.filter((l) => !l.unavailable && l.qtyAvailable > 0);
  if (buyable.length === 0) {
    return { ok: false, error: "Tu carrito está vacío o los productos ya no están disponibles" };
  }

  const phone = toE164(data.phone, data.country);
  const subtotal = buyable.reduce((sum, l) => sum + l.lineTotal, 0);

  // Si hay sesión de comprador, su pedido se ata a SU cliente por identidad.
  const buyer = await currentBuyer();

  // ── Cupón ──
  // Se REVALIDA por completo aquí, aunque ya se validara al aplicarlo: entre
  // una cosa y otra el cupón pudo agotarse por otro comprador o pausarse desde
  // el panel. La validación al aplicar es para la experiencia; la que decide
  // es esta.
  let coupon: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  if (data.couponCode) {
    coupon = await validateCoupon(data.couponCode, cart, { phone, email: data.email });
    if (!coupon.ok) {
      return { ok: false, error: coupon.message, field: "couponCode" };
    }
  }
  const discountTotal = coupon?.ok ? coupon.discount : 0;
  const total = Math.max(0, subtotal - discountTotal);

  // El producto regalado, si el cupón es de ese tipo.
  const freeVariant = coupon?.ok && coupon.freeVariantId
    ? await db.variant.findUnique({
        where: { id: coupon.freeVariantId },
        include: { product: true },
      })
    : null;
  const freeItem =
    freeVariant && coupon?.ok
      ? {
          variantId: freeVariant.id,
          qty: 1,
          unitPrice: 0,
          total: 0,
          productName: freeVariant.product.name,
          variantName: `${freeVariant.name} · Regalo cupón ${coupon.coupon.code}`,
          sku: freeVariant.sku,
        }
      : null;
  const address = compactAddress({
    country: data.country,
    address: data.address,
    address2: data.address2,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    zip: data.zip,
  });

  try {
    const order = await db.$transaction(async (tx) => {
      const customer = await resolveOrderCustomer(tx, {
        buyerCustomerId: buyer?.customerId ?? null,
        name: data.name,
        email: data.email,
        phone,
        document: data.document,
        country: data.country,
        city: data.city,
        address,
        acceptsMarketing: data.acceptsMarketing,
      });

      // Consumo del uso, con ESCRITURA CONDICIONAL: solo incrementa si sigue
      // activo y por debajo de su máximo. Leer, comprobar y luego escribir
      // dejaría una ventana en la que dos compradores con el último uso verían
      // ambos que queda uno. Aquí decide la base — mismo criterio que el motor
      // de inventario con el stock.
      //
      // Si no afecta ninguna fila, el cupón se agotó entre validar y crear: se
      // lanza y la transacción entera se deshace, así que el pedido no se crea.
      if (coupon?.ok) {
        const filas = await tx.$executeRaw`
          UPDATE coupons
          SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
          WHERE id = ${coupon.coupon.id}
            AND active = true
            AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
        `;
        if (filas === 0) throw new CouponRaceError();
      }

      const created = await tx.order.create({
        data: {
          channel: "WEB",
          status: "PENDING",
          currency,
          customerId: customer.id,
          subtotal,
          discountTotal,
          total,
          contactName: data.name,
          contactPhone: phone,
          contactEmail: data.email,
          contactDocument: data.document
            ? `${data.documentType ?? "CC"} ${data.document}`
            : null,
          shipCountry: data.country,
          shipState: data.state,
          shipCity: data.city,
          shipAddress: data.address,
          shipAddress2: data.address2 || null,
          shipNeighborhood: data.neighborhood || null,
          shipZip: data.zip || null,
          shipNotes: data.notes || null,
          paymentPreference: data.paymentPreference,
          checkoutToken: data.checkoutToken,
          expiresAt: new Date(Date.now() + ORDER_TTL_MS),
          items: {
            create: [
              ...buyable.map((l) => ({
                variantId: l.variantId,
                qty: l.qtyAvailable,
                unitPrice: l.unitPrice,
                total: l.lineTotal,
                productName: l.productName,
                variantName: l.variantName,
                sku: l.sku,
              })),
              // El regalo entra como línea NORMAL con precio cero: así su stock
              // lo descuenta el motor de inventario al confirmar, igual que
              // cualquier otro ítem. Un regalo que no descontara stock sería
              // inventario que desaparece del almacén y no de la base.
              ...(freeItem ? [freeItem] : []),
            ],
          },
          statusHistory: {
            create: { from: "PENDING", to: "PENDING", note: "Pedido creado desde la tienda web" },
          },
        },
      });

      if (coupon?.ok) {
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.coupon.id,
            orderId: created.id,
            customerId: customer.id,
            amount: discountTotal,
          },
        });
      }

      // El mensaje necesita el consecutivo, que solo existe tras el insert.
      const message = buildWhatsappMessage({
        orderNumber: formatOrderNumber(created.number, created.createdAt),
        currency,
        items: buyable.map((l) => ({
          qty: l.qtyAvailable,
          productName: l.productName,
          variantName: l.variantName,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
        total,
        discount: coupon?.ok ? { code: coupon.coupon.code, amount: discountTotal } : undefined,
        contactName: data.name,
        contactPhone: phone,
        address,
        paymentPreference: data.paymentPreference,
      });

      return tx.order.update({
        where: { id: created.id },
        data: { whatsappMessage: message },
      });
    });

    return orderResult(order);
  } catch (e) {
    // El cupón se agotó o se pausó entre validarlo y crear el pedido. La
    // transacción se deshizo entera: el pedido NO se creó y el uso NO se
    // consumió. Se devuelve el mensaje del canje, no un error genérico.
    if (e instanceof CouponRaceError) {
      return { ok: false, error: e.message, field: "couponCode" };
    }

    // Carrera: dos envíos simultáneos pasaron la verificación de arriba y la
    // base rechazó el segundo por el token único. El pedido SÍ existe —
    // devolverlo en vez de un error que haría reintentar y duplicar.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      String(e.meta?.target ?? "").includes("checkoutToken")
    ) {
      const winner = await db.order.findUnique({
        where: { checkoutToken: data.checkoutToken },
      });
      if (winner) return orderResult(winner);
    }
    // Sin redirigir y sin vaciar el carrito (PED_HU002, manejo de errores).
    return { ok: false, error: "No pudimos crear tu pedido. Intenta de nuevo." };
  }
}
