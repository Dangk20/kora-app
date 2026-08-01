// Programador de trabajos.
// Ver openspec/changes/scheduled-jobs — specs/job-scheduling.
//
// Decide qué toca, reclama la ejecución en exclusiva, la corre con tope de
// duración y registra el resultado.
// Lo importante no es ejecutar: es que quede constancia de que se ejecutó, para
// que DEJAR de correr sea detectable. Un trabajo programado no falla
// ruidosamente, se apaga en silencio.

import { db } from "@/lib/db";
import { JOBS, type JobDefinition } from "./definitions";

type Db = typeof db;

/**
 * Cierra las ejecuciones que quedaron en vuelo porque su proceso murió.
 *
 * Sin esto, la fila abierta de un proceso muerto bloquearía el trabajo para
 * siempre — el índice único solo permite una en vuelo. Es la misma idea de
 * recuperación de huérfanos que usa la bandeja de salida.
 *
 * Se cierran como FALLIDAS y no se borran: una ejecución que murió a mitad es
 * información, y borrarla la haría indistinguible de una que nunca ocurrió.
 */
async function reapStale(client: Db, job: JobDefinition): Promise<void> {
  await client.$executeRaw`
    UPDATE job_runs
    SET result = 'FAILURE',
        "finishedAt" = NOW(),
        error = 'la ejecución no terminó: el proceso murió o superó su tope'
    WHERE job = ${job.name}
      AND "finishedAt" IS NULL
      AND "startedAt" < NOW() - (${job.timeoutMs} || ' milliseconds')::interval
  `;
}

/**
 * Reclama la ejecución de un trabajo en exclusiva.
 *
 * La exclusión la garantiza un ÍNDICE ÚNICO PARCIAL sobre los registros en
 * vuelo: si otro proceso ya está corriendo este trabajo, el insert viola la
 * restricción y aquí se traduce a "omitido".
 *
 * ⚠️ Dos caminos descartados, ambos por motivos que costó encontrar:
 *
 * 1. **Cerrojos consultivos** (`pg_try_advisory_lock`): son de SESIÓN, y con un
 *    pool de conexiones se toman en una conexión y se intentan liberar en otra.
 *    La liberación falla en silencio y el trabajo queda bloqueado el resto de la
 *    vida del pool. Las pruebas pasaban aisladas y fallaban en la suite.
 * 2. **`INSERT ... WHERE NOT EXISTS`**: no es atómico. Dos ejecuciones
 *    simultáneas pueden ver ambas "no existe" y ambas insertar. Parecía
 *    funcionar porque el fallo depende del momento exacto.
 *
 * La exclusión de algo que cancela pedidos no puede depender del azar.
 */
async function claimRun(
  client: Db,
  job: JobDefinition,
): Promise<{ id: string } | "locked"> {
  await reapStale(client, job);
  try {
    const registro = await client.jobRun.create({
      data: { job: job.name, result: "FAILURE" }, // pesimista hasta demostrar lo contrario
      select: { id: true },
    });
    return registro;
  } catch (e) {
    // Violación del índice único parcial = ya hay una ejecución en vuelo.
    if (e instanceof Error && /Unique constraint|duplicate key/i.test(e.message)) {
      return "locked";
    }
    throw e;
  }
}

/**
 * ¿Le toca correr?
 *
 * Se mide desde la ÚLTIMA EJECUCIÓN registrada y no desde un temporizador en
 * memoria: así el programador resiste reinicios. Con un temporizador, un
 * despliegue cada pocas horas dejaría la verificación nocturna sin correr nunca
 * —el proceso se reiniciaría antes de que su temporizador venciera—.
 */
export async function isDue(job: JobDefinition, client: Db = db): Promise<boolean> {
  const ultima = await client.jobRun.findFirst({
    where: { job: job.name, result: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  if (!ultima) return true;
  return Date.now() - ultima.startedAt.getTime() >= job.everyMs;
}

async function conTope<T>(promesa: Promise<T>, ms: number, nombre: string): Promise<T> {
  let temporizador: NodeJS.Timeout;
  const tope = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error(`"${nombre}" superó su tope de ${Math.round(ms / 1000)} s`)),
      ms,
    );
  });
  try {
    return await Promise.race([promesa, tope]);
  } finally {
    clearTimeout(temporizador!);
  }
}

export type RunOutcome = {
  job: string;
  result: "SUCCESS" | "FAILURE" | "SKIPPED";
  summary?: string;
  error?: string;
  durationMs?: number;
};

/**
 * Ejecuta un trabajo de forma exclusiva y registra el resultado.
 *
 * El registro se escribe AL INICIAR y se completa al terminar: una fila sin
 * fecha de fin es exactamente una ejecución que murió a mitad, y así se
 * distingue de una que nunca empezó.
 */
export async function runJob(job: JobDefinition, client: Db = db): Promise<RunOutcome> {
  const reclamo = await claimRun(client, job);

  if (reclamo === "locked") {
    // "Omitido" es información, no ausencia de información: queda registrado.
    await client.jobRun.create({
      data: {
        job: job.name,
        result: "SKIPPED",
        finishedAt: new Date(),
        durationMs: 0,
        summary: "omitido: la ejecución anterior seguía en curso",
      },
    });
    return { job: job.name, result: "SKIPPED" };
  }

  const inicio = Date.now();
  try {
    const { summary } = await conTope(job.run(), job.timeoutMs, job.name);
    const durationMs = Date.now() - inicio;
    await client.jobRun.update({
      where: { id: reclamo.id },
      data: { result: "SUCCESS", finishedAt: new Date(), durationMs, summary },
    });
    return { job: job.name, result: "SUCCESS", summary, durationMs };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - inicio;
    await client.jobRun.update({
      where: { id: reclamo.id },
      data: { result: "FAILURE", finishedAt: new Date(), durationMs, error },
    });
    return { job: job.name, result: "FAILURE", error, durationMs };
  }
}

/**
 * Un ciclo: ejecuta los trabajos que toquen.
 *
 * El fallo de uno NO detiene a los demás — precisamente cuando algo va mal es
 * cuando más falta hacen los otros.
 */
export async function runDueJobs(client: Db = db, jobs = JOBS): Promise<RunOutcome[]> {
  const resultados: RunOutcome[] = [];
  for (const job of jobs) {
    try {
      if (!(await isDue(job, client))) continue;
      resultados.push(await runJob(job, client));
    } catch (e) {
      // Un fallo del propio andamiaje (base caída al consultar si toca) no
      // puede tumbar el programador ni saltarse los trabajos siguientes.
      resultados.push({
        job: job.name,
        result: "FAILURE",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return resultados;
}
