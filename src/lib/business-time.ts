// El día del negocio.
//
// KORA vende desde Colombia y su contabilidad cierra en días de Colombia. El
// servidor corre en UTC, y esas dos cosas no coinciden: entre las 7 p.m. y la
// medianoche de Bogotá ya es el día siguiente en UTC.
//
// Ignorarlo no rompe nada de forma visible — y por eso es peligroso. Una venta
// confirmada a las 10 de la mañana aparecía en la gráfica del día anterior, y
// el operador no tiene forma de sospecharlo: la cifra es plausible, solo está
// en la columna equivocada. Al cierre de mes, el dinero cae en el mes que no es.
//
// La regla ya existía en el número de pedido ("el año es el de Colombia, no el
// del servidor"); vive aquí para que la use todo el que agrupe por fecha.

export const BUSINESS_TIMEZONE = "America/Bogota";

const YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día del negocio al que pertenece un instante: `YYYY-MM-DD`. */
export function businessDayKey(instant: Date): string {
  return YMD.format(instant);
}

/** `YYYY-MM-DD` del día del negocio, desplazado `days` días. */
export function businessDayKeyOffset(instant: Date, days: number): string {
  const [y, m, d] = businessDayKey(instant).split("-").map(Number);
  // Se opera sobre la fecha civil en UTC a mediodía: sin hora local de por
  // medio, sumar días no puede caerse por un cambio de huso.
  const base = new Date(Date.UTC(y, m - 1, d, 12));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/**
 * Desfase del huso del negocio en ese instante, en minutos.
 *
 * Se pregunta en vez de escribir −5 a mano: Colombia no cambia la hora hoy,
 * pero un número mágico enterrado en el código es la clase de cosa que nadie
 * revisa cuando algo cambia.
 */
function offsetMinutes(instant: Date): number {
  const parte = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;

  const m = parte?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return -5 * 60; // Bogotá, si el entorno no soporta longOffset
  const signo = m[1] === "-" ? -1 : 1;
  return signo * (Number(m[2]) * 60 + Number(m[3]));
}

/** El instante en que empieza, en Colombia, el día civil `YYYY-MM-DD`. */
export function businessDayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const utcMedianoche = Date.UTC(y, m - 1, d);
  // Mediodía de referencia para preguntar el desfase sin caer en un borde.
  const off = offsetMinutes(new Date(utcMedianoche + 12 * 3600_000));
  return new Date(utcMedianoche - off * 60_000);
}

/** Inicio del día del negocio que contiene a `instant`. */
export function startOfBusinessDay(instant: Date): Date {
  return businessDayStart(businessDayKey(instant));
}

/** Inicio del mes del negocio que contiene a `instant`. */
export function startOfBusinessMonth(instant: Date): Date {
  const [y, m] = businessDayKey(instant).split("-");
  return businessDayStart(`${y}-${m}-01`);
}

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Etiqueta corta del día (Lun, Mar…) a partir de su clave `YYYY-MM-DD`. */
export function businessDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return DIAS_CORTOS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

/**
 * Expresión SQL que agrupa una columna de fecha por día del negocio.
 *
 * ⚠️ LOS DOS `AT TIME ZONE` SON NECESARIOS Y NO SON SIMÉTRICOS. Prisma guarda
 * las fechas en columnas `timestamp` SIN zona, con el valor en UTC. Sobre una
 * columna así, `AT TIME ZONE 'America/Bogota'` significa *"interpreta esto como
 * hora de Bogotá"* — justo lo contrario de lo que hace falta, y desplaza los
 * días cinco horas hacia el lado equivocado sin que nada falle.
 *
 * El orden correcto es: primero declarar que lo guardado es UTC, y luego
 * pedirlo en hora de Bogotá.
 */
export function sqlBusinessDay(column: string): string {
  return `to_char(date_trunc('day', (${column} AT TIME ZONE 'UTC') AT TIME ZONE '${BUSINESS_TIMEZONE}'), 'YYYY-MM-DD')`;
}
