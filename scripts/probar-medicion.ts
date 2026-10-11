// Prueba de punta a punta de la medición publicitaria, sin pedido real.
//
//   pnpm medicion:probar                 → usa KORA_META_TEST_EVENT_CODE
//   pnpm medicion:probar TEST12345       → código de "Eventos de prueba" de Meta
//
// - Meta: envía una compra de prueba con el código de eventos de prueba. Sin
//   código se NIEGA: una compra inventada en el píxel real ensuciaría los datos
//   con los que Meta optimiza las campañas, y no se puede borrar.
// - GA4: usa el validador (`/debug/mp/collect`), que revisa la carga útil y NO
//   registra nada. El endpoint real responde 204 incluso a cargas inválidas, así
//   que es la única forma de saber que está bien formada.
import "dotenv/config";
import { readMeasurementConfig } from "../src/modules/measurement/config";
import {
  buildGa4Purchase,
  buildMetaPurchase,
  sendGa4,
  sendMetaEvents,
  type ConfirmedOrder,
} from "../src/modules/measurement/purchase";
import { storeUrl } from "../src/lib/site";

const ahora = new Date();
const PEDIDO: ConfirmedOrder = {
  id: `prueba-${ahora.getTime()}`,
  number: 999999,
  createdAt: ahora,
  confirmedAt: ahora,
  currency: "COP",
  total: 85000,
  customerId: "cliente-de-prueba",
  contactName: "Ana Prueba",
  contactEmail: "prueba@korashopp.com",
  contactPhone: "+573000000000",
  billCity: "Neiva",
  billState: "Huila",
  billCountry: "CO",
  billZip: null,
  items: [{ sku: "PRUEBA-001", productName: "Producto de prueba", qty: 1, unitPrice: 85000 }],
  attribution: {
    fbp: null,
    fbc: null,
    gaClientId: "123456789.1700000000",
    gaSessionId: null,
    userAgent: "Mozilla/5.0 (prueba KORA)",
    ipAddress: "181.48.0.1",
  },
};

async function main() {
  let config;
  try {
    config = readMeasurementConfig();
  } catch (e) {
    console.error(`\n✖ ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  }
  if (!config.meta && !config.ga4) {
    console.log("\nNo hay ninguna plataforma configurada (KORA_META_* / KORA_GA4_*). Nada que probar.\n");
    return;
  }
  let fallos = 0;

  if (config.meta) {
    const codigo = process.argv[2]?.trim() || config.meta.testEventCode;
    if (!codigo) {
      console.log(
        "\n⚠️  Meta: sin código de eventos de prueba, no se envía nada.\n" +
          "   Cópialo del Administrador de eventos → tu píxel → Eventos de prueba, y corre:\n" +
          "   pnpm medicion:probar TEST12345\n",
      );
    } else {
      try {
        const r = await sendMetaEvents({ ...config.meta, testEventCode: codigo }, [
          buildMetaPurchase(PEDIDO, `${storeUrl()}/checkout`),
        ]);
        console.log(
          `\n✔ Meta recibió ${r.eventsReceived} evento(s). Míralo en Administrador de eventos → Eventos de prueba (código ${codigo}).`,
        );
      } catch (e) {
        fallos++;
        console.error(`\n✖ Meta: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  if (config.ga4) {
    try {
      const r = await sendGa4(config.ga4, buildGa4Purchase(PEDIDO), { debug: true });
      if (r.validationMessages.length === 0) {
        console.log("✔ GA4: la carga útil de la compra es válida (validador, no se registró nada).");
      } else {
        fallos++;
        console.error("✖ GA4 encontró problemas:", JSON.stringify(r.validationMessages, null, 2));
      }
    } catch (e) {
      fallos++;
      console.error(`✖ GA4: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("");
  if (fallos > 0) process.exit(1);
}

main();
