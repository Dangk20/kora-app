// Los trabajos programados del sistema.
// Ver openspec/changes/scheduled-jobs — specs/job-scheduling.
//
// Cada trabajo llama a una FUNCIÓN, no a un comando de package.json. Lanzar un
// proceso hijo por ejecución cuesta arranque y memoria, y su resultado habría
// que deducirlo de un código de salida y de texto impreso. Llamando a la
// función se obtiene el resumen estructurado que el registro necesita y los
// errores llegan como excepciones con su mensaje.
//
// Los comandos de package.json siguen existiendo para ejecución manual: llaman
// a estas mismas funciones, así que la lógica no está duplicada.

import { pruneExpiredSessions } from "@/modules/buyer/session";
import { dispatchOnce } from "@/modules/campaigns/dispatch";
import { startDueCampaigns } from "@/modules/campaigns/send";
import { marketingEnabled } from "@/modules/campaigns/lock";
import { expireCashback } from "@/modules/cashback/ledger";
import { describeVerification, verifyCashbackLedger } from "@/modules/cashback/verify";
import { findLedgerMismatches } from "@/modules/inventory/engine";
import { expireStaleOrders } from "@/modules/orders/expire";
import { outboxHealth } from "@/modules/events/health";

/** Lo que un trabajo devuelve para dejar constancia de qué hizo. */
export type JobOutcome = { summary: string };

export type JobDefinition = {
  /** Identificador estable: es la clave del registro y del cerrojo. */
  readonly name: string;
  /** Cada cuánto debe correr, en milisegundos. */
  readonly everyMs: number;
  /** Tope de duración. Superado, la ejecución se marca fallida. */
  readonly timeoutMs: number;
  /** Descripción para el diagnóstico. */
  readonly description: string;
  run(): Promise<JobOutcome>;
};

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

export const JOBS: readonly JobDefinition[] = [
  {
    name: "orders:expire",
    description: "Cancela los pedidos pendientes que superaron su vigencia de 2 h",
    // Un pedido vence a las 2 h; 5 min acota el error a un margen despreciable
    // frente a esa ventana.
    everyMs: 5 * MINUTO,
    timeoutMs: 2 * MINUTO,
    async run() {
      // La cancelación pasa por la máquina de estados del pedido: este trabajo
      // no escribe estados, invoca la lógica que ya existe y está probada.
      const r = await expireStaleOrders();
      return {
        summary:
          r.expired === 0
            ? "sin pedidos vencidos"
            : `${r.expired} pedido(s) cancelados: ${r.numbers.join(", ")}`,
      };
    },
  },
  {
    name: "ledger:verify",
    description: "Comprueba que stockActual cuadra con la suma de movimientos",
    // Recorre todo el inventario: de madrugada, cuando no compite con compradores.
    everyMs: 24 * HORA,
    timeoutMs: 15 * MINUTO,
    async run() {
      const mismatches = await findLedgerMismatches();
      if (mismatches.length > 0) {
        // AVISA, NO CORRIGE. Un libro contable descuadrado es un síntoma;
        // corregirlo automáticamente borra la evidencia del problema que hay
        // que investigar — y el inventario unificado web+POS es el
        // diferenciador del producto.
        const detalle = mismatches
          .map((m) => `${m.sku} (materializado ${m.stockActual} vs libro ${m.ledgerSum})`)
          .join("; ");
        throw new Error(`${mismatches.length} variante(s) no cuadran: ${detalle}`);
      }
      return { summary: "el libro contable cuadra en todas las variantes" };
    },
  },
  {
    name: "cashback:expire",
    description: "Vence los lotes de Kora Cashback que cumplieron 12 meses",
    // Un lote vive 12 meses: revisar a diario acota el error a un día, que
    // frente a esa ventana es despreciable. Si no corriera, el cashback viviría
    // para siempre — dinero que el negocio creía haber recuperado.
    everyMs: 24 * HORA,
    timeoutMs: 15 * MINUTO,
    async run() {
      const r = await expireCashback();
      if (r.lots === 0) return { summary: "sin lotes de cashback por vencer" };
      // Los importes por moneda se informan por separado: no existe tasa de
      // cambio en KORA y sumarlos daría un número sin significado.
      const montos = [r.cop > 0 ? `${r.cop} COP` : null, r.usd > 0 ? `${r.usd} USD` : null]
        .filter(Boolean)
        .join(" + ");
      return { summary: `${r.lots} lote(s) vencidos por ${montos}` };
    },
  },
  {
    name: "cashback:verify",
    description: "Comprueba que los saldos de cashback cuadran con su libro",
    // Recorre todos los clientes: de madrugada, como la del inventario.
    everyMs: 24 * HORA,
    timeoutMs: 15 * MINUTO,
    async run() {
      const v = await verifyCashbackLedger();
      if (!v.ok) {
        // AVISA, NO CORRIGE — igual que el libro del inventario, y con más
        // razón: aquí lo descuadrado es dinero que alguien puede gastar.
        throw new Error(describeVerification(v));
      }
      return { summary: "el libro de cashback cuadra en todos los clientes" };
    },
  },
  {
    name: "campaigns:dispatch",
    description: "Envía por lotes la campaña de correo en curso",
    // Un minuto: con lotes de 50 son 3.000 correos por hora, de sobra para una
    // tienda que envía promociones. Aquí no hay cola aparte a propósito — el
    // plan técnico proponía BullMQ, pero cuando se escribió no existía este
    // programador. Dos sistemas de cola conviviendo serían dos formas de
    // fallar y más memoria en un VPS que ya va justo.
    everyMs: MINUTO,
    timeoutMs: 5 * MINUTO,
    async run() {
      // El candado también aquí: si el módulo se cierra con una campaña ya
      // programada, cerrarlo solo en el panel la dejaría saliendo igual desde
      // el worker — que es donde de verdad se envía.
      if (!marketingEnabled()) return { summary: "email marketing cerrado" };
      const r = await dispatchOnce();
      if (!r.campaignId) return { summary: "sin campañas en curso" };
      if (r.finished) return { summary: `campaña "${r.campaignName}" terminada` };
      if (r.sent + r.failed + r.skipped === 0) {
        return { summary: `campaña "${r.campaignName}": lote vacío` };
      }
      const partes = [`${r.sent} enviado(s)`];
      if (r.failed > 0) partes.push(`${r.failed} fallido(s)`);
      if (r.skipped > 0) partes.push(`${r.skipped} omitido(s) por baja`);
      return { summary: `campaña "${r.campaignName}": ${partes.join(", ")}` };
    },
  },
  {
    name: "campaigns:schedule",
    description: "Dispara las campañas programadas cuya hora llegó",
    // Un minuto de margen sobre la hora elegida por el operador es invisible
    // para una promoción y evita un sondeo más agresivo.
    everyMs: MINUTO,
    timeoutMs: 5 * MINUTO,
    async run() {
      if (!marketingEnabled()) return { summary: "email marketing cerrado" };
      const r = await startDueCampaigns();
      return {
        summary: r.started === 0 ? "sin campañas por disparar" : `${r.started} iniciada(s): ${r.names.join(", ")}`,
      };
    },
  },
  {
    name: "sessions:prune",
    description: "Borra las sesiones de compradores ya caducadas",
    // No es seguridad —una sesión caducada ya no autentica— sino higiene: sin
    // barrido, la tabla crece con cada sesión que alguien abrió y nunca cerró.
    everyMs: 24 * HORA,
    timeoutMs: 5 * MINUTO,
    async run() {
      const n = await pruneExpiredSessions();
      return { summary: n === 0 ? "sin sesiones caducadas" : `${n} sesión(es) borradas` };
    },
  },
  {
    name: "outbox:status",
    description: "Vigila que la bandeja de salida de eventos no se atasque",
    // Suficiente para detectar un atasco antes de que importe, sin convertir
    // el registro en ruido.
    everyMs: 15 * MINUTO,
    timeoutMs: 2 * MINUTO,
    async run() {
      const h = await outboxHealth();
      if (h.counts.dead > 0) {
        throw new Error(
          `${h.counts.dead} evento(s) muertos en la bandeja de salida — pnpm outbox:status para el detalle`,
        );
      }
      // La antigüedad del pendiente más viejo es lo que distingue "hay carga"
      // de "está atascado"; un conteo alto por sí solo no dice nada.
      const edad = h.oldestPendingAgeSeconds;
      if (edad !== null && edad > 600) {
        throw new Error(
          `la bandeja parece atascada: el pendiente más viejo lleva ${Math.round(edad / 60)} min`,
        );
      }
      return {
        summary: `${h.counts.pending} pendiente(s), ${h.counts.processed} procesado(s)`,
      };
    },
  },
];

export function jobByName(name: string): JobDefinition | undefined {
  return JOBS.find((j) => j.name === name);
}
