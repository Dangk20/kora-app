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
import { subscribeFromCheckout } from "@/modules/consent/subscription";
import { consumeCashback, CashbackError } from "@/modules/cashback/ledger";
import { resolveRedemption } from "@/modules/cashback/redemption";
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
  // Igual que el cupón: llega la INTENCIÓN, no el descuento. Cuánto se puede
  // aplicar lo decide el servidor leyendo el libro de cashback.
  cashbackRequested: z.coerce.number().min(0).optional().default(0),
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
  const totalTrasCupon = Math.max(0, subtotal - discountTotal);

  // ── Kora Cashback ──
  // Se resuelve en SERVIDOR, con el saldo leído del libro. La exclusión mutua
  // con cupones es una regla del cliente y se comprueba aquí aunque la
  // interfaz ya la impida: la petición no tiene por qué venir de la interfaz.
  const canje = await resolveRedemption({
    customerId: buyer?.customerId ?? null,
    requested: data.cashbackRequested,
    orderTotal: totalTrasCupon,
    currency,
    hasCoupon: Boolean(coupon?.ok),
  });
  if (!canje.ok && canje.reason !== "NOT_REQUESTED") {
    return { ok: false, error: canje.message, field: "cashback" };
  }
  const cashbackApplied = canje.ok ? canje.amount : 0;
  const total = Math.max(0, totalTrasCupon - cashbackApplied);

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

      // El saldo se consume ANTES de crear el pedido y dentro de su misma
      // transacción: `consumeCashback` bloquea la fila del cliente, y tomar ese
      // bloqueo pronto es lo que serializa a dos pedidos que peleen por el
      // mismo saldo — el segundo espera y relee lo ya gastado. Si no alcanza,
      // lanza y no queda ni consumo ni pedido.
      if (cashbackApplied > 0) {
        await consumeCashback(tx, {
          customerId: customer.id,
          amount: cashbackApplied,
          currency,
        });
      }

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
          cashbackApplied,
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
        cashbackApplied,
        contactName: data.name,
        contactPhone: phone,
        address,
        paymentPreference: data.paymentPreference,
      });

      const guardado = await tx.order.update({
        where: { id: created.id },
        data: { whatsappMessage: message },
        include: { customer: { select: { id: true } } },
      });

      // Bandeja de salida: el pedido y su aviso se escriben JUNTOS o ninguno.
      // De aquí cuelgan el correo al comprador y el aviso al operador — nada
      // se envía dentro de esta transacción, porque atar la venta a que un
      // tercero responda es cambiar un problema pequeño por el peor de todos.
      await tx.domainEvent.create({
        data: {
          type: "order.created",
          payload: {
            orderId: created.id,
            orderNumber: created.number,
            customerId: customer.id,
            currency,
            total: total.toString(),
          },
        },
      });

      return guardado;
    });

    // El consentimiento se registra DESPUÉS del pedido y fuera de su
    // transacción, a propósito: no forma parte de la atomicidad de la venta
    // —si fallara, el pedido sigue siendo válido— y `subscribeFromCheckout`
    // abre la suya. Respeta a quien se dio de baja: volver a comprar NO
    // re-suscribe.
    if (order.customer) {
      await subscribeFromCheckout(order.customer.id, data.acceptsMarketing);
    }

    return orderResult(order);
  } catch (e) {
    // El cupón se agotó o se pausó entre validarlo y crear el pedido. La
    // transacción se deshizo entera: el pedido NO se creó y el uso NO se
    // consumió. Se devuelve el mensaje del canje, no un error genérico.
    if (e instanceof CouponRaceError) {
      return { ok: false, error: e.message, field: "couponCode" };
    }

    // Otro pedido del mismo comprador se llevó el saldo entre que se calculó el
    // aplicable y que se intentó gastarlo. La transacción se deshizo entera: no
    // hay pedido ni consumo. Se le dice qué pasó, no un error genérico — el
    // saldo que ve en pantalla ya no es el que tiene.
    if (e instanceof CashbackError && e.code === "INSUFFICIENT") {
      return {
        ok: false,
        error: "Tu saldo de Kora Cashback cambió mientras completabas el pedido. Vuelve a intentarlo.",
        field: "cashback",
      };
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
