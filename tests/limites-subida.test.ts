// El límite de Next y el de la aplicación no pueden discrepar.
//
// La app valida hasta `MAX_IMAGE_BYTES`, pero Next corta el cuerpo de una
// Server Action ANTES de que ese código se ejecute. Si el de Next es menor,
// las fotos grandes mueren con un 413 y el operador ve "Application error"
// sin ninguna pista de que su archivo pesaba demasiado.
//
// Pasó en pruebas el 7 ago con la Vitrina: límite de Next 1 MB por omisión,
// límite de la app 5 MB.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES } from "@/modules/storage";

/** Lee `serverActions.bodySizeLimit` de next.config.ts, en bytes. */
function limiteDeNext(): number {
  const fuente = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  const m = /bodySizeLimit:\s*"(\d+)(kb|mb)"/i.exec(fuente);
  if (!m) throw new Error("next.config.ts no declara serverActions.bodySizeLimit");
  const n = Number(m[1]);
  return m[2].toLowerCase() === "mb" ? n * 1024 * 1024 : n * 1024;
}

describe("límite de subida", () => {
  it("Next acepta al menos lo que la aplicación valida", () => {
    expect(limiteDeNext()).toBeGreaterThanOrEqual(MAX_IMAGE_BYTES);
  });

  it("y deja margen para el sobre del formulario", () => {
    // El cuerpo lleva además nombre de campo, límites de multipart y la
    // codificación: un límite exactamente igual al archivo rechaza el archivo.
    expect(limiteDeNext()).toBeGreaterThan(MAX_IMAGE_BYTES * 1.1);
  });

  it("el límite de la aplicación sigue siendo el que se cree", () => {
    // Si alguien sube MAX_IMAGE_BYTES sin tocar next.config, la primera
    // prueba falla — pero esta deja claro contra qué número se comparaba.
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });
});
