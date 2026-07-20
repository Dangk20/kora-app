// Máquina de estados y expiración de pedidos (PED_HU003).
// La regla que protege la operación: no se puede "devolver" un pedido a un
// estado anterior ni resucitar uno entregado.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  canTransition,
  formatTimeLeft,
  minutesLeft,
  nextStatus,
  ORDER_FLOW,
} from "@/modules/orders/status";
import { expireStaleOrders } from "@/modules/orders/expire";

describe("transiciones permitidas", () => {
  it("avanza por el flujo, un paso o varios", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "DELIVERED")).toBe(true); // saltos hacia adelante
  });

  it("NUNCA retrocede", () => {
    expect(canTransition("CONFIRMED", "PENDING")).toBe(false);
    expect(canTransition("SHIPPED", "PREPARING")).toBe(false);
    expect(canTransition("DELIVERED", "SHIPPED")).toBe(false);
  });

  it("no permite quedarse en el mismo estado", () => {
    for (const status of ORDER_FLOW) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("solo se cancela desde Pendiente o Confirmado", () => {
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    // Ya empacado o enviado: cancelar deja de ser una operación limpia.
    expect(canTransition("PREPARING", "CANCELLED")).toBe(false);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
  });

  it("los estados terminales no salen de ahí por transición normal", () => {
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("CANCELLED", "PENDING")).toBe(false); // reabrir es otra acción
  });

  it("propone el siguiente estado del flujo", () => {
    expect(nextStatus("PENDING")).toBe("CONFIRMED");
    expect(nextStatus("SHIPPED")).toBe("DELIVERED");
    expect(nextStatus("DELIVERED")).toBeNull();
    expect(nextStatus("CANCELLED")).toBeNull();
  });
});

describe("vigencia del pedido", () => {
  const now = new Date("2026-07-19T12:00:00");

  it("calcula los minutos restantes", () => {
    expect(minutesLeft(new Date("2026-07-19T13:12:00"), now)).toBe(72);
    expect(minutesLeft(new Date("2026-07-19T11:30:00"), now)).toBe(-30);
    expect(minutesLeft(null, now)).toBeNull();
  });

  it("presenta el tiempo como lo lee un operador", () => {
    expect(formatTimeLeft(72)).toBe("1 h 12 min");
    expect(formatTimeLeft(120)).toBe("2 h");
    expect(formatTimeLeft(25)).toBe("25 min");
    expect(formatTimeLeft(0)).toBe("Expirado");
    expect(formatTimeLeft(-5)).toBe("Expirado");
  });
});

describe("expiración automática", () => {
  const SKU = "TEST-EXP-0001";

  async function createOrder(expiresAt: Date, status: "PENDING" | "CONFIRMED" = "PENDING") {
    return db.order.create({
      data: {
        channel: "WEB",
        status,
        currency: "COP",
        subtotal: 1000,
        total: 1000,
        expiresAt,
        contactName: `Test expiración ${SKU}`,
      },
    });
  }

  async function cleanup() {
    await db.orderStatusHistory.deleteMany({
      where: { order: { contactName: { startsWith: "Test expiración" } } },
    });
    await db.order.deleteMany({
      where: { contactName: { startsWith: "Test expiración" } },
    });
  }

  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("cancela los pendientes vencidos y deja rastro en el historial", async () => {
    const vencido = await createOrder(new Date(Date.now() - 60_000));
    const vigente = await createOrder(new Date(Date.now() + 60 * 60_000));

    const result = await expireStaleOrders();
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(result.numbers).toContain(vencido.number);

    const [after, untouched] = await Promise.all([
      db.order.findUniqueOrThrow({ where: { id: vencido.id } }),
      db.order.findUniqueOrThrow({ where: { id: vigente.id } }),
    ]);
    expect(after.status).toBe("CANCELLED");
    expect(after.expiresAt).toBeNull();
    expect(untouched.status).toBe("PENDING"); // el vigente no se toca

    const history = await db.orderStatusHistory.findMany({
      where: { orderId: vencido.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      from: "PENDING",
      to: "CANCELLED",
      actorId: null, // actor "sistema"
    });
    expect(history[0].note).toContain("Expiración automática");
  });

  it("no toca pedidos que ya fueron confirmados aunque tengan fecha vencida", async () => {
    const confirmado = await createOrder(new Date(Date.now() - 60_000), "CONFIRMED");
    await expireStaleOrders();
    const after = await db.order.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(after.status).toBe("CONFIRMED");
  });

  it("es seguro correrlo dos veces seguidas (el cron se solapa)", async () => {
    await createOrder(new Date(Date.now() - 60_000));
    const first = await expireStaleOrders();
    const second = await expireStaleOrders();
    expect(first.expired).toBeGreaterThanOrEqual(1);
    expect(second.expired).toBe(0); // ya no queda nada vencido
  });
});
