// ¿Qué decide la geolocalización para una IP?
//
//   pnpm geo:check 190.85.100.1
//
// Existe porque el modo de fallo de todo este mecanismo es SILENCIOSO: una
// detección apagada no produce ningún error, solo una tienda que enseña pesos
// a todo el mundo. Esto lo convierte en una pregunta con respuesta.
//
// Ver openspec/changes/deteccion-moneda-por-ip — specs/visitor-geolocation.

import { INSTANTANEA } from "../src/modules/geo";
import { origenDeIp } from "../src/modules/geo/lookup";
import { currencyForOrigin } from "../src/modules/pricing";
import { RANGOS_V4, RANGOS_V6_CO } from "../src/modules/geo/tabla";

const ip = process.argv[2];

if (!ip) {
  console.error("\nUso: pnpm geo:check <ip>\n  Ejemplo: pnpm geo:check 190.85.100.1\n");
  process.exit(1);
}

const origen = origenDeIp(ip);
const moneda = currencyForOrigin(origen);

const explicacion: Record<typeof origen, string> = {
  colombia: "la IP está en un rango asignado a Colombia",
  exterior: "la IP está en un rango asignado a otro país",
  desconocido:
    "la IP no está en la tabla, no es una dirección de internet, o es una IPv6 no colombiana",
};

console.log(
  `\n  IP        ${ip}` +
    `\n  Origen    ${origen} — ${explicacion[origen]}` +
    `\n  Moneda    ${moneda}` +
    `\n\n  Tabla del ${INSTANTANEA}: ${RANGOS_V4} rangos IPv4, ${RANGOS_V6_CO} rangos IPv6 colombianos.` +
    `\n  Se regenera con \`pnpm geo:update\`.\n`,
);
