// Normalización y cifrado de los datos del comprador que se envían a Meta.
//
// Meta empareja comparando huellas SHA-256: "Ana@Correo.com " y
// "ana@correo.com" son personas distintas si no se normaliza ANTES de cifrar,
// y la venta queda sin emparejar sin que nada falle. Las reglas son las de la
// documentación de la API de Conversiones (parámetros de cliente).

import { createHash } from "node:crypto";

export function sha256(v: string): string {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

function sinTildes(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normEmail(v: string | null | undefined): string | null {
  const t = v?.trim().toLowerCase();
  return t && t.includes("@") ? t : null;
}

/** Solo dígitos, con indicativo de país: `+57 314 275 1611` → `573142751611`. */
export function normPhone(v: string | null | undefined): string | null {
  const d = v?.replace(/\D/g, "");
  return d && d.length >= 8 ? d : null;
}

/** Nombre o apellido: minúsculas, sin tildes, solo letras. */
export function normName(v: string | null | undefined): string | null {
  const t = v ? sinTildes(v.trim().toLowerCase()).replace(/[^a-zñ]/g, "") : "";
  return t || null;
}

/** Ciudad o departamento: minúsculas, sin tildes ni espacios ni signos. */
export function normPlace(v: string | null | undefined): string | null {
  const t = v ? sinTildes(v.trim().toLowerCase()).replace(/[^a-z0-9]/g, "") : "";
  return t || null;
}

export function normCountry(v: string | null | undefined): string | null {
  const t = v?.trim().toLowerCase();
  return t && /^[a-z]{2}$/.test(t) ? t : null;
}

export function normZip(v: string | null | undefined): string | null {
  const t = v?.trim().toLowerCase().replace(/\s/g, "");
  return t || null;
}

/**
 * Nombre y apellido desde el nombre completo: primera y última palabra
 * ("Ana María Pérez Gómez" → "ana" / "gomez"). Es una aproximación: el
 * checkout pide un solo campo de nombre.
 */
export function splitName(full: string | null | undefined): { fn: string | null; ln: string | null } {
  const partes = full?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (partes.length === 0) return { fn: null, ln: null };
  if (partes.length === 1) return { fn: normName(partes[0]), ln: null };
  return { fn: normName(partes[0]), ln: normName(partes[partes.length - 1]) };
}

/** Cifra un valor ya normalizado; `null` se queda `null`. */
export function hashed(v: string | null): string | null {
  return v ? sha256(v) : null;
}
