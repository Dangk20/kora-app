// Diagnóstico de la bandeja de salida.
//
//   pnpm outbox:status              estado de la cola
//   pnpm outbox:status --retry <id> devuelve un evento muerto a la cola
//   pnpm outbox:status --retry-all  devuelve TODOS los muertos a la cola
//
// Ver openspec/changes/outbox-worker — specs/event-observability.

import "dotenv/config";
import { db } from "../src/lib/db";
import { outboxHealth, retryAllDead, retryDeadEvent } from "../src/modules/events/health";
import { registerAllHandlers } from "../src/modules/events/handlers";

function minutos(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  if (segundos < 3600) return `${Math.round(segundos / 60)} min`;
  return `${(segundos / 3600).toFixed(1)} h`;
}

async function main() {
  registerAllHandlers();
  const args = process.argv.slice(2);

  const iRetry = args.indexOf("--retry");
  if (iRetry !== -1) {
    const id = args[iRetry + 1];
    if (!id) throw new Error("Falta el identificador del evento: --retry <id>");
    await retryDeadEvent(id);
    console.log(`↻ evento ${id} devuelto a la cola con el contador reiniciado.`);
    return;
  }

  if (args.includes("--retry-all")) {
    const n = await retryAllDead();
    console.log(`↻ ${n} evento(s) muerto(s) devueltos a la cola.`);
    return;
  }

  const h = await outboxHealth();
  const { pending, processing, processed, dead } = h.counts;

  console.log("Bandeja de salida de eventos");
  console.log("────────────────────────────");
  console.log(`  pendientes  ${pending}`);
  console.log(`  en proceso  ${processing}`);
  console.log(`  procesados  ${processed}`);
  console.log(`  muertos     ${dead}`);

  // El dato que de verdad distingue "hay carga" de "está atascado".
  if (h.oldestPendingAgeSeconds === null) {
    console.log("\n✅ Sin eventos pendientes.");
  } else {
    const edad = h.oldestPendingAgeSeconds;
    console.log(`\n  pendiente más viejo: hace ${minutos(edad)}`);
    if (edad > 600) {
      console.log("  ⚠️  Más de 10 minutos: la cola parece atascada, no con carga.");
      console.log("     Comprobar que el worker está corriendo.");
    }
  }

  if (h.unhandledTypes.length > 0) {
    console.log(`\n⚠️  Tipos sin manejador registrado: ${h.unhandledTypes.join(", ")}`);
  }

  if (h.dead.length > 0) {
    console.log("\n💀 Eventos muertos (agotaron sus intentos):");
    for (const e of h.dead) {
      console.log(`  ${e.id} · ${e.type} · ${e.attempts} intentos`);
      console.log(`     ${e.lastError ?? "(sin motivo registrado)"}`);
    }
    console.log("\n  Corregida la causa: pnpm outbox:status --retry <id>");
  }

  if (dead > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
