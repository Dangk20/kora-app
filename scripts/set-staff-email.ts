// Dirección de correo a la que llegan los avisos de pedido nuevo.
//
//   pnpm staff:email pedidos@korashopp.com   → la fija
//   pnpm staff:email --ver                    → muestra la actual
//
// Vive en `settings` y no en el código porque cambiarla es una decisión del
// negocio, no un despliegue. Sin configurar, el aviso se omite dejando
// constancia en el historial del pedido — nunca falla la venta.
import { ORDER_TTL_HOURS } from "../src/modules/orders/status";
import "dotenv/config";
import { db } from "../src/lib/db";
import { setStaffEmail, staffEmail } from "../src/modules/notifications/settings";

async function main() {
  const arg = process.argv[2]?.trim();

  if (!arg || arg === "--ver") {
    const actual = await staffEmail();
    console.log(
      actual
        ? `\nLos avisos de pedido nuevo llegan a: ${actual}\n`
        : "\n⚠️  Sin configurar: NADIE recibe aviso cuando entra un pedido.\n" +
            `   Un pedido pendiente expira en ${ORDER_TTL_HOURS} h; si nadie lo ve, la venta se cae sola.\n` +
            "   Fíjala con: pnpm staff:email <correo>\n",
    );
    return;
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(arg)) {
    console.error(`\n🔴 "${arg}" no parece un correo válido.\n`);
    process.exitCode = 1;
    return;
  }

  await setStaffEmail(arg);
  console.log(`\n✅ Los avisos de pedido nuevo llegarán a: ${arg.toLowerCase()}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
