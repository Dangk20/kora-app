// Verificación del libro de Kora Cashback: pnpm cashback:verify
// En producción corre a diario dentro del worker (trabajo `cashback:verify`);
// esto es el mismo chequeo, a mano. Exit 1 si algo no cuadra.
//
// AVISA, NO CORRIGE — igual que la verificación del inventario.
import "dotenv/config";
import { db } from "../src/lib/db";
import { describeVerification, verifyCashbackLedger } from "../src/modules/cashback/verify";

async function main() {
  const v = await verifyCashbackLedger();
  if (v.ok) {
    console.log("✅ Libro de cashback OK: cada saldo cuadra con la suma de sus movimientos.");
    return;
  }
  console.error("🔴 " + describeVerification(v));
  console.error("   No se corrige nada a propósito: hay que averiguar qué escribió mal.");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
