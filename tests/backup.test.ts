// Lectura del estado del respaldo.
//
// Lo que se fija aquí es una distinción que parece pedante y no lo es: "nunca
// ha corrido" y "lleva días sin correr" son fallos distintos, se arreglan en
// sitios distintos, y confundirlos hace que una instalación incompleta se lea
// como una avería temporal.
import { describe, expect, it } from "vitest";
import {
  VENTANA_HORAS,
  describeBackupStatus,
  parseBackupLog,
} from "@/modules/backup/status";

const AHORA = new Date("2026-08-07T12:00:00Z");

/** Una línea de registro como la que escribe respaldar.sh. */
function ok(iso: string, bytes = 84_912): string {
  return `${iso}|OK|respaldo subido: kora-${iso.replace(/[-:]/g, "")}.dump.age (${bytes} bytes)`;
}

describe("estado del respaldo", () => {
  it("un respaldo de hace pocas horas está al día", () => {
    const s = parseBackupLog(ok("2026-08-07T03:30:00Z"), AHORA);

    expect(s.estado).toBe("ok");
    if (s.estado !== "nunca") {
      expect(s.bytes).toBe(84_912);
      expect(s.horasDesde).toBeCloseTo(8.5, 1);
    }
  });

  it("toma el MÁS RECIENTE, no el último escrito", () => {
    // El registro se añade al final, pero un reintento manual puede dejar una
    // línea antigua después de una nueva.
    const log = [ok("2026-08-07T03:30:00Z", 90_000), ok("2026-08-05T03:30:00Z", 10)].join("\n");
    const s = parseBackupLog(log, AHORA);

    expect(s.estado).toBe("ok");
    if (s.estado !== "nunca") expect(s.bytes).toBe(90_000);
  });

  it("pasada la ventana, está atrasado", () => {
    const s = parseBackupLog(ok("2026-08-04T03:30:00Z"), AHORA);

    expect(s.estado).toBe("atrasado");
    if (s.estado !== "nunca") expect(s.horasDesde).toBeGreaterThan(VENTANA_HORAS);
  });

  it("sin ninguna línea correcta, es 'nunca' — no 'atrasado'", () => {
    expect(parseBackupLog("", AHORA).estado).toBe("nunca");
  });

  it("un registro lleno de errores sigue siendo 'nunca'", () => {
    // Aquí está el fallo que más importa: si un respaldo lleva un mes fallando
    // todas las noches, el registro está LLENO de líneas. Contarlas como
    // actividad diría "el respaldo está corriendo" mientras no existe ninguno.
    const log = [
      "2026-08-07T03:30:00Z|INFO|iniciando respaldo de 'kora-prod-postgres'",
      "2026-08-07T03:30:04Z|ERROR|el envío a 'r2:kora-respaldos' falló",
      "2026-08-06T03:30:00Z|INFO|iniciando respaldo de 'kora-prod-postgres'",
      "2026-08-06T03:30:03Z|ERROR|pg_dump falló (código 1)",
    ].join("\n");

    expect(parseBackupLog(log, AHORA).estado).toBe("nunca");
  });

  it("un 'iniciando' no cuenta como respaldo hecho", () => {
    const log = [
      ok("2026-08-01T03:30:00Z"),
      "2026-08-07T03:30:00Z|INFO|iniciando respaldo de 'kora-prod-postgres'",
    ].join("\n");

    // El último OK es del 1 de agosto: atrasado, aunque haya actividad de hoy.
    const s = parseBackupLog(log, AHORA);
    expect(s.estado).toBe("atrasado");
  });

  it("ignora líneas con fecha ilegible en vez de reventar", () => {
    const log = ["no-es-una-fecha|OK|algo (1 bytes)", ok("2026-08-07T03:30:00Z")].join("\n");
    expect(parseBackupLog(log, AHORA).estado).toBe("ok");
  });
});

describe("cómo se cuenta el estado", () => {
  it("'nunca' dice que no existe ninguno, no que esté atrasado", () => {
    const texto = describeBackupStatus(parseBackupLog("", AHORA));

    expect(texto).toContain("NUNCA");
    expect(texto).toContain("no existe ninguno");
  });

  it("'atrasado' dice cuánto lleva sin ocurrir", () => {
    const texto = describeBackupStatus(parseBackupLog(ok("2026-08-01T03:30:00Z"), AHORA));

    expect(texto).toMatch(/hace \d+/);
    expect(texto).toContain(String(VENTANA_HORAS));
  });

  it("'al día' informa fecha y tamaño", () => {
    const texto = describeBackupStatus(parseBackupLog(ok("2026-08-07T03:30:00Z"), AHORA));

    expect(texto).toContain("2026-08-07T03:30:00");
    expect(texto).toContain("KiB");
  });
});
