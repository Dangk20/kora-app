// Estado de los trabajos programados.
//
//   pnpm jobs:status
//
// Termina con código distinto de cero si algún trabajo está atrasado o su
// última ejecución falló, para poder encadenarlo a una comprobación automática
// cuando exista un canal de alertas.

import "dotenv/config";
import { db } from "../src/lib/db";
import { haySenalDeAlarma, jobsStatus } from "../src/modules/jobs/health";

function humano(ms: number | null): string {
  if (ms === null) return "nunca";
  const s = Math.round(ms / 1000);
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${(s / 3600).toFixed(1)} h`;
  return `hace ${(s / 86400).toFixed(1)} días`;
}

async function main() {
  const estados = await jobsStatus();

  console.log("Trabajos programados");
  console.log("────────────────────");
  for (const e of estados) {
    const marca = e.neverRan ? "·" : e.overdue ? "🔴" : e.lastResult === "FAILURE" ? "⚠️ " : "✅";
    console.log(`\n${marca} ${e.job}  (cada ${Math.round(e.everyMs / 60000)} min)`);
    console.log(`   ${e.description}`);
    if (e.neverRan) {
      console.log("   nunca ha corrido");
    } else {
      console.log(`   última vez con éxito: ${humano(e.sinceLastSuccessMs)}`);
      if (e.lastSummary) console.log(`   ${e.lastSummary}`);
      if (e.lastResult === "FAILURE" && e.lastError) console.log(`   ✖ ${e.lastError}`);
      if (e.overdue) console.log("   🔴 ATRASADO: lleva mucho más de su cadencia sin correr bien");
    }
  }

  if (haySenalDeAlarma(estados)) {
    console.log("\n⚠️  Hay trabajos atrasados o con fallos.");
    process.exitCode = 1;
  } else {
    console.log("\n✅ Todos al día.");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
