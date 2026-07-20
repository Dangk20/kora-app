// Job de expiración de pedidos (PED_HU003 §2).
// En producción corre cada 5 minutos vía cron; también sirve de chequeo
// manual: pnpm orders:expire
import "dotenv/config";
import { db } from "../src/lib/db";
import { expireStaleOrders } from "../src/modules/orders/expire";

async function main() {
  const result = await expireStaleOrders();
  if (result.expired === 0) {
    console.log("✅ Sin pedidos vencidos: nada que cancelar.");
    return;
  }
  console.log(
    `⏱️  ${result.expired} pedido(s) cancelados por expiración: ${result.numbers
      .map((n) => `KO-${String(n).padStart(5, "0")}`)
      .join(", ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
