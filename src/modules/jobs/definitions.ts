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
