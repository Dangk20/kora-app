// Escribe a disco un ejemplo de CADA correo del pedido: pnpm emails:preview
//
// Existe por el bloqueo del dominio. `korashopp.com` todavía no tiene SPF,
// DKIM ni DMARC, así que no sale ni un correo — pero el cliente sí puede ver y
// APROBAR las plantillas antes de que eso se resuelva. Los archivos quedan en
// `.emails/` y se abren con doble clic.
//
// Usa datos de ejemplo a propósito: no toca la base ni necesita un pedido real.
import "dotenv/config";
import { createFileDriver } from "../src/modules/email/file-driver";
import { renderOrderEmail, type OrderEmailData } from "../src/modules/notifications/render";
import type { OrderEmailType } from "../src/generated/prisma/enums";

const EJEMPLO: OrderEmailData = {
  orderId: "ejemplo",
  orderNumber: "KO-2026-00042",
  buyerName: "Laura Gómez",
  whatsappUrl:
    "https://api.whatsapp.com/send?phone=573142751611&text=Hola%20KORA%20%F0%9F%91%8B",
  order: {
    number: "KO-2026-00042",
    currency: "COP",
    lines: [
      { qty: 2, name: "Camiseta Essential", variant: "Talla M · Negro", total: 158_000 },
      { qty: 1, name: "Vela aromática", variant: "Única", total: 42_000 },
    ],
    subtotal: 200_000,
    discountTotal: 10_000,
    cashbackApplied: 5_000,
    total: 185_000,
  },
  cashbackEarned: 5_550,
  cashbackExpiresAt: new Date("2027-08-01T05:00:00Z"),
  cashbackRefunded: 5_000,
};

// Los siete, en el orden en que un comprador los recibiría.
const TODOS: OrderEmailType[] = [
  "BUYER_CREATED",
  "BUYER_CONFIRMED",
  "BUYER_PREPARING",
  "BUYER_SHIPPED",
  "BUYER_DELIVERED",
  "BUYER_CANCELLED",
  "STAFF_NEW_ORDER",
];

async function main() {
  const driver = createFileDriver();

  for (const type of TODOS) {
    const data =
      type === "BUYER_CANCELLED" ? { ...EJEMPLO, cancelReason: "EXPIRED" as const } : EJEMPLO;
    const email = renderOrderEmail(type, data);

    const r = await driver.send({
      to: type === "STAFF_NEW_ORDER" ? "pedidos@korashopp.com" : "laura@ejemplo.com",
      toName: type === "STAFF_NEW_ORDER" ? undefined : EJEMPLO.buyerName ?? undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // Ninguno lleva enlace de baja: son comprobantes, no publicidad.
    });

    console.log(r.ok ? `✅ ${type.padEnd(16)} ${r.providerId}` : `🔴 ${type}: ${r.error}`);
  }

  console.log("\nLos archivos están en .emails/ — ábrelos con doble clic.\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
