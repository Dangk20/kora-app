// Diagnóstico de los trabajos programados.
// Ver openspec/changes/scheduled-jobs — specs/job-observability.
//
// La pregunta que este archivo existe para responder no es "¿falló algo?" sino
// "¿cuánto hace que esto no corre bien?". Un trabajo que falla se ve en los
// registros; uno que dejó de programarse no se ve nunca — se ve el daño,
// semanas después.

import { db } from "@/lib/db";
import { JOBS } from "./definitions";

type Db = typeof db;

export type JobStatus = {
  job: string;
  description: string;
  everyMs: number;
  lastSuccessAt: Date | null;
  sinceLastSuccessMs: number | null;
  lastResult: "SUCCESS" | "FAILURE" | "SKIPPED" | null;
  lastError: string | null;
  lastSummary: string | null;
  /** Lleva más de lo que su cadencia permite sin correr bien. */
  overdue: boolean;
  /** Nunca ha corrido — distinto de haber corrido y fallado. */
  neverRan: boolean;
};

/**
 * Margen antes de declarar atrasado un trabajo: el triple de su cadencia.
 *
 * Con el doble, un reinicio del contenedor o una ejecución lenta darían falsas
 * alarmas, y una alarma que salta sin motivo se aprende a ignorar — que es
 * peor que no tenerla.
 */
const FACTOR_ATRASO = 3;

export async function jobsStatus(client: Db = db): Promise<JobStatus[]> {
  return Promise.all(
    JOBS.map(async (job) => {
      const [exito, ultima] = await Promise.all([
        client.jobRun.findFirst({
          where: { job: job.name, result: "SUCCESS" },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true, summary: true },
        }),
        client.jobRun.findFirst({
          where: { job: job.name },
          orderBy: { startedAt: "desc" },
          select: { result: true, error: true, summary: true },
        }),
      ]);

      const desde = exito ? Date.now() - exito.startedAt.getTime() : null;

      return {
        job: job.name,
        description: job.description,
        everyMs: job.everyMs,
        lastSuccessAt: exito?.startedAt ?? null,
        sinceLastSuccessMs: desde,
        lastResult: ultima?.result ?? null,
        lastError: ultima?.error ?? null,
        lastSummary: ultima?.summary ?? exito?.summary ?? null,
        // Nunca haber corrido NO es estar atrasado: es un estado propio, y
        // confundirlos haría que un despliegue recién hecho pareciera roto.
        overdue: desde !== null && desde > job.everyMs * FACTOR_ATRASO,
        neverRan: ultima === null,
      };
    }),
  );
}

/** ¿Hay algo que mirar? Es lo que decide el código de salida del comando. */
export function haySenalDeAlarma(estados: JobStatus[]): boolean {
  return estados.some((e) => e.overdue || e.lastResult === "FAILURE");
}

/**
 * Retención del historial.
 *
 * Tres trabajos, uno cada 5 minutos, son más de cien mil filas al año: una
 * tabla de diagnóstico que se convierte en el problema de espacio de la base
 * deja de servir para diagnosticar.
 *
 * NUNCA borra la última ejecución con éxito de cada trabajo: es la que sostiene
 * todo el diagnóstico. Si se limpiara, un trabajo que lleva un mes sin correr
 * parecería no haber corrido nunca, que es un diagnóstico distinto.
 */
export async function pruneJobRuns(retentionDays = 7, client: Db = db): Promise<number> {
  const corte = new Date(Date.now() - retentionDays * 24 * 60 * 60_000);

  const intocables = (
    await Promise.all(
      JOBS.map((j) =>
        client.jobRun.findFirst({
          where: { job: j.name, result: "SUCCESS" },
          orderBy: { startedAt: "desc" },
          select: { id: true },
        }),
      ),
    )
  )
    .filter((r): r is { id: string } => r !== null)
    .map((r) => r.id);

  const { count } = await client.jobRun.deleteMany({
    where: { startedAt: { lt: corte }, id: { notIn: intocables } },
  });
  return count;
}
