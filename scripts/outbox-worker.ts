// Consumidor de la bandeja de salida de eventos de dominio.
// Proceso de larga duración: en los entornos corre como su propio contenedor.
//
//   pnpm outbox:worker
//
// Ver openspec/changes/outbox-worker.

import "dotenv/config";
import { db } from "../src/lib/db";
import { runOnce, DEFAULT_BATCH_SIZE } from "../src/modules/events/consumer";
import { registerAllHandlers, registeredTypes } from "../src/modules/events/handlers";

const INTERVALO_MS = Number(process.env.OUTBOX_POLL_MS ?? 5_000);
const LOTE = Number(process.env.OUTBOX_BATCH ?? DEFAULT_BATCH_SIZE);

let detener = false;
let procesando = false;

async function ciclo() {
  procesando = true;
  try {
    const resultados = await runOnce(db, LOTE);
    for (const r of resultados) {
      // Se registra el identificador, el tipo y el resultado — nunca el
      // contenido del evento, que lleva datos del comprador.
      switch (r.result) {
        case "processed":
          console.log(`✅ ${r.event} · ${r.handlers} manejador(es)`);
          break;
        case "retry":
          console.warn(`↻ ${r.event} · intento ${r.attempts} · ${r.error}`);
          break;
        case "dead":
          console.error(`💀 ${r.event} · muerto tras ${r.attempts} intentos · ${r.error}`);
          break;
        case "unhandled":
          console.warn(`⚠️  ${r.event} · sin manejador registrado`);
          break;
      }
    }
  } catch (e) {
    // Un fallo del propio ciclo (base caída, por ejemplo) no puede tumbar el
    // proceso: se registra y se reintenta en el siguiente.
    console.error("✖ fallo del ciclo:", e instanceof Error ? e.message : e);
  } finally {
    procesando = false;
  }
}

async function main() {
  registerAllHandlers();
  console.log(
    `▸ worker de la bandeja de salida activo · cada ${INTERVALO_MS} ms · lotes de ${LOTE}\n` +
      `  tipos atendidos: ${registeredTypes().join(", ") || "(ninguno)"}`,
  );

  while (!detener) {
    await ciclo();
    // Espera troceada para que una parada no tenga que aguantar el intervalo
    // completo antes de responder.
    for (let i = 0; i < INTERVALO_MS && !detener; i += 250) {
      await new Promise((r) => setTimeout(r, Math.min(250, INTERVALO_MS - i)));
    }
  }

  // Parada ordenada: deja de tomar eventos nuevos y espera a que termine el
  // que tiene entre manos, para no dejarlo huérfano en PROCESSING.
  while (procesando) await new Promise((r) => setTimeout(r, 100));
  console.log("▸ worker detenido");
}

for (const señal of ["SIGINT", "SIGTERM"] as const) {
  process.on(señal, () => {
    if (detener) return;
    console.log(`▸ ${señal} recibida — terminando el evento en curso antes de salir`);
    detener = true;
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
