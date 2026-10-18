// Validación de los datos del registro rápido de la ruleta (Daniel, 17 oct
// 2026): la apertura existe para captar datos de contacto VÁLIDOS, así que no
// se acepta "lo que sea". Funciones puras: las usa el formulario mientras se
// escribe y el servidor antes de crear nada (el navegador no es de fiar).

/** Celular colombiano: empieza por 3 y tiene 10 dígitos. Admite +57 delante. */
export function celularColombiano(escrito: string): string | null {
  let d = escrito.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

/**
 * Correo con forma real: usuario@dominio.ext, sin espacios, con una extensión
 * de letras de al menos 2 (".co", ".com"). No basta con que tenga una "@".
 */
const CORREO = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export function correoValido(escrito: string): string | null {
  const c = escrito.trim().toLowerCase();
  if (c.length > 254 || c.includes("..")) return null;
  return CORREO.test(c) ? c : null;
}

/** Los dominios que usa casi toda la clientela. */
const POPULARES = [
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
  "hotmail.es", "outlook.es", "yahoo.es", "live.com",
];

/** Dominios reales que se parecen a un popular y NO son un error ("mail.com"). */
const LEGITIMOS = new Set([
  "mail.com", "email.com", "ymail.com", "gmx.com", "aol.com", "msn.com", "me.com", "live.com",
  "live.com.co", "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
  "hotmail.es", "outlook.es", "yahoo.es", "yahoo.com.co", "hotmail.com.co", "outlook.com.co",
]);

/** Distancia de edición con trasposición (Damerau-Levenshtein, versión óptima). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * "pepe@gmil.com" → "pepe@gmail.com"; null si el dominio no parece un error.
 *
 * Por PARECIDO y no con una lista de errores: "gmil.com" no estaba en ninguna
 * lista y además existe en internet, así que la verificación del dominio
 * tampoco lo frena (Daniel lo encontró el 17 oct). A una o dos letras de un
 * dominio popular, y sin ser un dominio real conocido, es un error de dedo.
 */
export function sugerenciaCorreo(escrito: string): string | null {
  const c = escrito.trim().toLowerCase();
  const at = c.lastIndexOf("@");
  if (at < 1) return null;
  const dominio = c.slice(at + 1);
  if (LEGITIMOS.has(dominio) || dominio.length < 5) return null;
  let mejor: { dominio: string; d: number } | null = null;
  for (const p of POPULARES) {
    const d = distancia(dominio, p);
    if (d <= 2 && (!mejor || d < mejor.d)) mejor = { dominio: p, d };
  }
  return mejor ? `${c.slice(0, at)}@${mejor.dominio}` : null;
}
