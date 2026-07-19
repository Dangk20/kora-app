// Job de verificación del libro contable (plan técnico §2.1).
// En producción corre cada noche vía cron; exit 1 si algo no cuadra
// (el cron alerta). También sirve como chequeo manual: pnpm ledger:verify
import "dotenv/config";
import { db } from "../src/lib/db";
import { findLedgerMismatches } from "../src/modules/inventory/engine";

async function main() {
  const mismatches = await findLedgerMismatches();
  if (mismatches.length === 0) {
    console.log("✅ Libro contable OK: stockActual cuadra con la suma de movimientos en todas las variantes.");
    return;
  }
  console.error(`🔴 ${mismatches.length} variante(s) NO cuadran:`);
  for (const m of mismatches) {
    console.error(
      `   ${m.sku}: stockActual=${m.stockActual} vs suma de movimientos=${m.ledgerSum}`,
    );
  }
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
