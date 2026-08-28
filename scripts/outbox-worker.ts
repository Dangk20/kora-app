// Worker de KORA: hace dos cosas en un solo proceso.
//   1. Consume la bandeja de salida de eventos de dominio.
//   2. Dispara los trabajos programados cuando les toca.
//
//   pnpm outbox:worker
//
// Van juntos a propósito: ya hay un proceso de larga duración por entorno, con
// bucle, parada ordenada y acceso a la base. Un segundo contenedor cuyo trabajo
// es DORMIR cuesta memoria comprometida en una máquina con poco margen y añade
// otro proceso que puede caerse en silencio. Los trabajos son cortos y poco
// frecuentes; el sondeo de la bandeja es ligero. No compiten por nada.
//
// Ver openspec/changes/outbox-worker y openspec/changes/scheduled-jobs.

import "dotenv/config";
import { db } from "../src/lib/db";
import { assertConfiguracionDeArranqueOrExit } from "../src/lib/startup-guards";
import { runOnce, DEFAULT_BATCH_SIZE } from "../src/modules/events/consumer";
import { registerAllHandlers, registeredTypes } from "../src/modules/events/handlers";
import { JOBS } from "../src/modules/jobs/definitions";
import { pruneJobRuns } from "../src/modules/jobs/health";
import { runDueJobs } from "../src/modules/jobs/scheduler";

const INTERVALO_MS = Number(process.env.OUTBOX_POLL_MS ?? 5_000);
const LOTE = Number(process.env.OUTBOX_BATCH ?? DEFAULT_BATCH_SIZE);
// Reversión del diseño: apagarlo deja el worker consumiendo eventos como antes,
// y los trabajos vuelven a ejecutarse a mano. Sin pérdida.
const PROGRAMADOR = process.env.JOBS_SCHEDULER !== "off";
let ultimaLimpieza = 0;

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
    if (PROGRAMADOR) await ciclarTrabajos();
  } catch (e) {
    // Un fallo del propio ciclo (base caída, por ejemplo) no puede tumbar el
    // proceso: se registra y se reintenta en el siguiente.
    console.error("✖ fallo del ciclo:", e instanceof Error ? e.message : e);
  } finally {
    procesando = false;
  }
}

async function ciclarTrabajos() {
  for (const r of await runDueJobs(db)) {
    switch (r.result) {
      case "SUCCESS":
        console.log(`⏱  ${r.job} · ${r.durationMs} ms · ${r.summary}`);
        break;
      case "FAILURE":
        console.error(`✖ ${r.job} · ${r.error}`);
        break;
      case "SKIPPED":
        console.warn(`⤼ ${r.job} · omitido: la ejecución anterior seguía en curso`);
        break;
    }
  }
  // Retención del historial, una vez al día. Sin esto la tabla de diagnóstico
  // acabaría siendo el problema de espacio de la base.
  if (Date.now() - ultimaLimpieza > 24 * 3600_000) {
    ultimaLimpieza = Date.now();
    const n = await pruneJobRuns();
    if (n > 0) console.log(`🧹 ${n} ejecución(es) antiguas eliminadas del historial`);
  }
}

async function main() {
  // Las MISMAS guardas de configuración que la aplicación.
  //
  // Faltaban aquí, y se vio al levantar producción por primera vez el 27 ago
  // 2026: la aplicación se negó a arrancar por falta de proveedor de correo y
  // **el worker se quedó arriba tan tranquilo**. Es la peor mitad para
  // olvidarlo, porque el worker es justamente QUIEN ENVÍA: sin proveedor no
  // habría fallado al desplegar —cuando se puede revertir— sino al despachar
  // el primer comprobante de un pedido real.
  //
  // Un worker sano sobre un entorno incompleto es peor que uno caído: nada
  // avisa, los eventos se consumen y sus manejadores fallan uno a uno.
  assertConfiguracionDeArranqueOrExit();

  registerAllHandlers();
  console.log(
    `▸ worker activo · sondeo cada ${INTERVALO_MS} ms · lotes de ${LOTE}\n` +
      `  eventos atendidos: ${registeredTypes().join(", ") || "(ninguno)"}\n` +
      `  trabajos programados: ${
        PROGRAMADOR ? JOBS.map((j) => j.name).join(", ") : "DESACTIVADOS (JOBS_SCHEDULER=off)"
      }`,
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
