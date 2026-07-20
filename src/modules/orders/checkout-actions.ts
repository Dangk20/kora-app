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

/** Validez del pedido pendiente (PED_HU003). */
const ORDER_TTL_MS = 2 * 60 * 60 * 1000;

const baseSchema = z.object({
  checkoutToken: z.string().min(10).max(100),
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

/** Teléfono a E.164 — es la clave de match del cliente (PED_HU001). */
function toE164(phone: string, country: "CO" | "US"): string {
  const digits = phone.replace(/\D/g, "");
  const prefix = country === "CO" ? "57" : "1";
  const national = digits.startsWith(prefix)
    ? digits.slice(prefix.length)
    : digits;
  return `+${prefix}${national}`;
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
  const total = buyable.reduce((sum, l) => sum + l.lineTotal, 0);
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
      // Cliente silencioso (PED_HU001 §4): match por email o teléfono.
      const found = await tx.customer.findFirst({
        where: { OR: [{ email: data.email }, { phone }] },
      });
      const customer = found
        ? await tx.customer.update({
            where: { id: found.id },
            data: {
              name: data.name,
              phone,
              email: data.email,
              document: data.document ?? found.document,
              country: data.country,
              city: data.city,
              address,
              // El opt-in nunca se revoca solo: si ya aceptó, sigue aceptado.
              acceptsMarketing: found.acceptsMarketing || data.acceptsMarketing,
            },
          })
        : await tx.customer.create({
            data: {
              name: data.name,
              phone,
              email: data.email,
              document: data.document,
              country: data.country,
              city: data.city,
              address,
              source: "WEB",
              acceptsMarketing: data.acceptsMarketing,
            },
          });

      const created = await tx.order.create({
        data: {
          channel: "WEB",
          status: "PENDING",
          currency,
          customerId: customer.id,
          subtotal: total,
          discountTotal: 0,
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
            create: buyable.map((l) => ({
              variantId: l.variantId,
              qty: l.qtyAvailable,
              unitPrice: l.unitPrice,
              total: l.lineTotal,
              productName: l.productName,
              variantName: l.variantName,
              sku: l.sku,
            })),
          },
          statusHistory: {
            create: { from: "PENDING", to: "PENDING", note: "Pedido creado desde la tienda web" },
          },
        },
      });

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
