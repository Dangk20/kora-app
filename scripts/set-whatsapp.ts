// Cambia el número de WhatsApp al que llegan los pedidos, sin tocar código
// ni desplegar. Mientras no exista la pantalla de Configuración, este es el
// camino oficial.
//
//   pnpm whatsapp:set +573142751611          → ambas monedas
//   pnpm whatsapp:set +573142751611 --co      → solo pedidos en COP
//   pnpm whatsapp:set +13055550123 --us       → solo pedidos en USD
//   pnpm whatsapp:set --ver                   → muestra la configuración actual
import "dotenv/config";
import { db } from "../src/lib/db";
import { WHATSAPP_KEYS } from "../src/modules/orders/settings";

const LABELS = { COP: "Pedidos en COP (Colombia)", USD: "Pedidos en USD (EE.UU.)" };

async function show() {
  console.log("\nDestino actual de los pedidos:\n");
  for (const currency of ["COP", "USD"] as const) {
    const row = await db.setting.findUnique({
      where: { key: WHATSAPP_KEYS[currency] },
    });
    const value = typeof row?.value === "string" ? row.value : null;
    console.log(
      `  ${LABELS[currency].padEnd(28)} ${value ?? "(sin configurar → usa el valor por defecto del código)"}`,
    );
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--ver")) return show();

  const number = args.find((a) => !a.startsWith("--"));
  if (!number || !/^\+\d{8,15}$/.test(number)) {
    console.error(
      `🔴 Número inválido: "${number ?? ""}".\n   Debe ir en formato internacional, ej: +573142751611`,
    );
    process.exitCode = 1;
    return;
  }

  const soloCo = args.includes("--co");
  const soloUs = args.includes("--us");
  const targets: ("COP" | "USD")[] =
    soloCo && !soloUs ? ["COP"] : soloUs && !soloCo ? ["USD"] : ["COP", "USD"];

  for (const currency of targets) {
    await db.setting.upsert({
      where: { key: WHATSAPP_KEYS[currency] },
      update: { value: number },
      create: { key: WHATSAPP_KEYS[currency], value: number },
    });
    console.log(`✅ ${LABELS[currency]} → ${number}`);
  }
  await show();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
