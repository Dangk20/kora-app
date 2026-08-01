// Normalización de teléfono a E.164.
// Ver openspec/changes/modulo-clientes — specs/customer-management.
//
// El teléfono es el IDENTIFICADOR ÚNICO del cliente: el checkout reconoce a un
// comprador que vuelve buscándolo por aquí. Por eso la normalización ocurre
// ANTES de comprobar duplicados y no solo antes de guardar — si se comparara lo
// que la persona escribió, `320 827 0414` y `+573208270414` entrarían como dos
// clientes distintos y la restricción de unicidad de la base no lo detectaría,
// porque para ella son cadenas diferentes. Y como los clientes no se pueden
// eliminar, ese duplicado sería permanente.

export type Country = "CO" | "US";

const PREFIX: Record<Country, string> = { CO: "57", US: "1" };

/** Misma lógica que usa el checkout (PED_HU001), en un solo sitio. */
export function toE164(phone: string, country: Country): string {
  const digits = phone.replace(/\D/g, "");
  const prefix = PREFIX[country];
  const national = digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
  return `+${prefix}${national}`;
}

/** Solo los dígitos, para buscar sin que importe el formato escrito. */
export function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Un teléfono es utilizable si, ya normalizado, tiene largo plausible. */
export function isUsablePhone(e164: string): boolean {
  const d = digitsOf(e164);
  return d.length >= 10 && d.length <= 15;
}
