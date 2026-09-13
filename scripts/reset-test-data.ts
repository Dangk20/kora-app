// Deja el entorno de PRUEBAS como recién cargado: sin compradores, sin pedidos,
// sin ventas y con el stock exactamente como estaba antes de cualquier compra.
//
//   pnpm test:reset --actor admin@ejemplo.com            → solo cuenta qué borraría
//   pnpm test:reset --actor admin@ejemplo.com --confirmar → lo hace
//
// Existe para la reunión de aprobación del 13 sep 2026: el guion de la demo
// compra SIN cuenta con un correo que ya había comprado y creado cuenta durante
// las pruebas, y los pedidos de los amigos que probaron dejaban ventas que no
// son del negocio.
//
// Qué NO toca: catálogo, fotos, usuarios del panel, configuración, consumo del
// proveedor de correo (`provider_sends`: eso sí se gastó) y eventos del
// proveedor. Qué SÍ: compradores (con sesiones, direcciones y cashback),
// pedidos (con ítems, historial, correos y comprobantes), canjes de cupones,
// la bandeja de eventos y las filas de campañas atadas a esos compradores.
//
// El stock se devuelve POR EL MOTOR (`setStockTo`), nunca a mano: queda un
// movimiento DEVOLUCION por variante que explica la vuelta, y el libro sigue
// cuadrando. Los movimientos de las ventas se conservan —el libro no borra—,
// solo se desatan del pedido que deja de existir.
import "dotenv/config";
import { db } from "../src/lib/db";
import { esProduccion } from "../src/lib/environment";
import { setStockTo } from "../src/modules/inventory/engine";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (esProduccion()) {
    console.error("⛔ Este script es SOLO para entornos de prueba. En producción no se borran compradores ni pedidos.");
    process.exit(1);
  }
  const confirmar = process.argv.includes("--confirmar");
  const actorEmail = arg("--actor");
  if (!actorEmail) {
    console.error("Falta --actor <correo de un usuario del panel>: la devolución de stock lleva firma.");
    process.exit(1);
  }
  const actor = await db.user.findUnique({ where: { email: actorEmail.toLowerCase() } });
  if (!actor) {
    console.error(`No existe el usuario ${actorEmail}.`);
    process.exit(1);
  }

  // 1 · Cuánto stock se llevaron los pedidos, variante por variante. Se mira el
  //     NETO de los movimientos atados a un pedido (venta y, si la hubo, la
  //     devolución de una cancelación) para no devolver dos veces.
  const porVariante = await db.stockMovement.groupBy({
    by: ["variantId"],
    where: { orderId: { not: null } },
    _sum: { delta: true },
  });
  const devoluciones = porVariante
    .map((g) => ({ variantId: g.variantId, unidades: -(g._sum.delta ?? 0) }))
    .filter((d) => d.unidades !== 0);

  const cuentas = {
    compradores: await db.customer.count(),
    pedidos: await db.order.count(),
    eventos: await db.domainEvent.count(),
    cashback: await db.cashbackMovement.count(),
    canjes: await db.couponRedemption.count(),
  };

  console.log("\nLimpieza del entorno de pruebas");
  console.log("────────────────────────────────");
  for (const [k, v] of Object.entries(cuentas)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log(`  stock a devolver: ${devoluciones.reduce((s, d) => s + d.unidades, 0)} unidad(es) en ${devoluciones.length} variante(s)`);

  if (!confirmar) {
    console.log("\nSimulación. Para ejecutarlo: añade --confirmar\n");
    return;
  }

  // 2 · Devolver el stock por el motor, ANTES de borrar los pedidos (sus
  //     movimientos son la fuente de cuánto devolver).
  for (const d of devoluciones) {
    const v = await db.variant.findUniqueOrThrow({ where: { id: d.variantId }, select: { sku: true, stockActual: true, onlineUnits: true } });
    const r = await setStockTo({
      variantId: d.variantId,
      target: v.stockActual + d.unidades,
      onlineTarget: Math.min(v.onlineUnits + d.unidades, v.stockActual + d.unidades),
      reason: "DEVOLUCION",
      actorId: actor.id,
      note: "Limpieza del entorno de pruebas: se devuelven las unidades de los pedidos borrados",
    });
    console.log(`  ↩ ${v.sku}: ${r.from} → ${r.to} (online ${r.online})`);
  }

  // 3 · Borrar en una sola transacción, de hijos a padres.
  await db.$transaction(async (tx) => {
    await tx.campaignRecipient.deleteMany();
    await tx.cashbackMovement.deleteMany();
    await tx.couponRedemption.deleteMany();
    await tx.stockMovement.updateMany({ where: { orderId: { not: null } }, data: { orderId: null } });
    await tx.order.deleteMany(); // ítems, historial, correos y comprobantes caen en cascada
    await tx.customer.deleteMany(); // sesiones, direcciones, consentimientos y códigos, en cascada
    await tx.domainEvent.deleteMany();
  });

  console.log("\n✅ Entorno limpio: sin compradores, sin pedidos, stock devuelto.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
