// Estado del respaldo: ¿cuándo fue el último correcto, y sigue ocurriendo?
//
// Es el modo de fallo más peligroso de cualquier sistema de copias, y el más
// fácil de pasar por alto: DEJAR DE CORRER no produce ningún error. La tienda
// sigue vendiendo, el panel sigue funcionando, nadie recibe una alerta, y el
// problema aparece el día que hay que restaurar — que es el único día en que ya
// no se puede arreglar.
//
// Por eso "no hay ningún respaldo reciente" es un FALLO explícito, y no la
// ausencia de noticias.
//
// Ver openspec/changes/encrypted-db-backup — specs/database-backup.

/** Cuánto puede pasar sin respaldo antes de considerarlo un fallo. */
export const VENTANA_HORAS = 48;

export type BackupStatus =
  | { estado: "ok"; ultimo: Date; bytes: number; horasDesde: number }
  | { estado: "atrasado"; ultimo: Date; bytes: number; horasDesde: number }
  | { estado: "nunca" };

/**
 * Una línea del registro que deja `deploy/backup/respaldar.sh`.
 *
 * Formato: `<fecha ISO>|<nivel>|<mensaje>`. Solo las de nivel `OK` cuentan como
 * respaldo completado: `INFO` marca etapas intermedias y `ERROR` marca fallos,
 * y confundir un "empecé a respaldar" con un "respaldé" es exactamente el error
 * que este módulo existe para no cometer.
 */
const LINEA = /^(\S+)\|OK\|.*?\((\d+) bytes\)/;

export function parseBackupLog(contenido: string, ahora: Date = new Date()): BackupStatus {
  let ultimo: Date | null = null;
  let bytes = 0;

  for (const linea of contenido.split("\n")) {
    const m = LINEA.exec(linea.trim());
    if (!m) continue;

    const fecha = new Date(m[1]);
    if (Number.isNaN(fecha.getTime())) continue;

    if (!ultimo || fecha > ultimo) {
      ultimo = fecha;
      bytes = Number(m[2]);
    }
  }

  if (!ultimo) return { estado: "nunca" };

  const horasDesde = (ahora.getTime() - ultimo.getTime()) / 3_600_000;

  return {
    // "Nunca ha corrido" y "lleva días sin correr" se distinguen a propósito:
    // el primero es una instalación incompleta y el segundo es algo que se
    // rompió. Se arreglan en sitios distintos.
    estado: horasDesde <= VENTANA_HORAS ? "ok" : "atrasado",
    ultimo,
    bytes,
    horasDesde,
  };
}

/** Texto para el diagnóstico por consola. */
export function describeBackupStatus(s: BackupStatus): string {
  if (s.estado === "nunca") {
    return (
      "✖ NUNCA se ha completado un respaldo.\n" +
      "  No es que esté atrasado: no existe ninguno. Si el servidor se pierde hoy,\n" +
      "  se pierde el negocio entero. Ver deploy/backup/README.md."
    );
  }

  const cuando = s.ultimo.toISOString();
  const kib = (s.bytes / 1024).toFixed(1);
  const horas = s.horasDesde.toFixed(1);

  if (s.estado === "atrasado") {
    return (
      `✖ El último respaldo correcto fue hace ${horas} h (${cuando}, ${kib} KiB).\n` +
      `  Supera la ventana de ${VENTANA_HORAS} h. El respaldo dejó de ocurrir y nada lo avisó.`
    );
  }

  return `✓ Último respaldo: ${cuando} (hace ${horas} h, ${kib} KiB).`;
}
