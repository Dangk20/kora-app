// Bandeja de salida de eventos. Lo crítico:
//   1. Dos trabajadores nunca toman el mismo evento (el primer consumidor real
//      acredita dinero: un doble procesamiento es un saldo regalado).
//   2. Reprocesar no duplica efectos — la entrega es *al menos una vez*.
//   3. Los reintentos son acotados y espaciados; lo que agota intentos muere
//      de forma terminal y visible.
//   4. Un evento cuyo trabajador murió vuelve a estar disponible.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  claimBatch,
  processEvent,
  recoverOrphans,
  runOnce,
} from "@/modules/events/consumer";
import { outboxHealth, retryDeadEvent } from "@/modules/events/health";
import { registerHandler, resetRegistry } from "@/modules/events/registry";
import { backoffMs, RETRY_POLICY, type EventHandler } from "@/modules/events/types";

const TIPO = "test.evento";

/**
 * Crea un evento listo para tomarse YA.
 *
 * `nextAttemptAt` va explícitamente en el pasado, y no es cosmético: el valor
 * por defecto lo pone Prisma con el reloj de la APLICACIÓN, mientras que
 * `claimBatch` lo compara contra `NOW()` de la BASE. Con el contenedor de
 * Postgres unos milisegundos atrasado —cosa habitual en una VM de desarrollo
 * que ha estado suspendida— el evento recién creado queda un instante "en el
 * futuro" y no se puede tomar: la prueba falla de forma intermitente por un
 * desfase de relojes, no por el código.
 *
 * En producción el worker sondea cada 5 s y ese desfase es invisible; queda
 * anotado en las notas técnicas privadas como deuda conocida de la cola.
 */
async function nuevoEvento(overrides: Record<string, unknown> = {}) {
  return db.domainEvent.create({
    data: {
      type: TIPO,
      payload: { n: 1 },
      nextAttemptAt: new Date(Date.now() - 1000),
      ...overrides,
    },
  });
}

const NO_ES_PRUEBA = { type: { not: { startsWith: "test." } } } as const;

/**
 * Aparta los eventos reales mientras corre la prueba.
 *
 * `claimBatch` no filtra por tipo —no debe hacerlo, su trabajo es tomar lo que
 * haya— así que en una base de desarrollo con eventos reales acabaría
 * tomándolos, procesándolos con manejadores de prueba y falseando los conteos.
 * En CI la base es efímera y daría igual; en la máquina de alguien, no.
 * Empujarlos fuera de su turno los hace invisibles para la toma sin borrarlos.
 */
async function apartarReales() {
  await db.domainEvent.updateMany({
    where: { ...NO_ES_PRUEBA, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "PENDING", claimedAt: null, nextAttemptAt: new Date(Date.now() + 3600_000) },
  });
}

/** Borra lo de prueba y devuelve los reales a su sitio, listos para procesarse. */
async function limpiar() {
  await db.domainEvent.deleteMany({ where: { type: { startsWith: "test." } } });
  await db.domainEvent.updateMany({
    where: { ...NO_ES_PRUEBA, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "PENDING", claimedAt: null, nextAttemptAt: new Date() },
  });
}

/** Manejador que cuenta invocaciones y puede fallar a voluntad. */
function contador(opts: { falla?: boolean; nombre?: string } = {}) {
  const estado = { veces: 0 };
  const handler: EventHandler = {
    name: opts.nombre ?? "contador",
    async handle() {
      estado.veces += 1;
      if (opts.falla) throw new Error("fallo simulado");
    },
  };
  return { handler, estado };
}

beforeEach(async () => {
  resetRegistry();
  await limpiar();
  await apartarReales();
});
afterEach(limpiar);

describe("espera entre reintentos", () => {
  it("crece con cada intento y se detiene en el techo", () => {
    expect(backoffMs(1)).toBe(RETRY_POLICY.baseDelayMs);
    expect(backoffMs(2)).toBe(RETRY_POLICY.baseDelayMs * 2);
    expect(backoffMs(3)).toBe(RETRY_POLICY.baseDelayMs * 4);
    expect(backoffMs(50)).toBe(RETRY_POLICY.maxDelayMs);
  });
});

describe("toma exclusiva de eventos", () => {
  it("dos trabajadores simultáneos no toman el mismo evento", async () => {
    // El equivalente aquí del test de las 50 compras concurrentes del
    // inventario: la exclusión tiene que ser de la base, no una suposición.
    const CUANTOS = 30;
    await Promise.all(Array.from({ length: CUANTOS }, () => nuevoEvento()));

    const [a, b] = await Promise.all([
      claimBatch(db, CUANTOS),
      claimBatch(db, CUANTOS),
    ]);

    const ids = [...a, ...b].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length); // ninguno tomado dos veces
    expect(ids.length).toBe(CUANTOS); // y entre los dos los tomaron todos
  });

  it("no toma un evento cuya espera todavía no ha llegado", async () => {
    await nuevoEvento({ nextAttemptAt: new Date(Date.now() + 60_000) });
    const tomados = await claimBatch(db, 10);
    expect(tomados).toHaveLength(0);
  });

  it("marca como en proceso lo que toma", async () => {
    const e = await nuevoEvento();
    await claimBatch(db, 10);
    const despues = await db.domainEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(despues.status).toBe("PROCESSING");
    expect(despues.claimedAt).not.toBeNull();
  });
});

describe("procesamiento", () => {
  it("marca como procesado cuando todos los manejadores tienen éxito", async () => {
    const { handler, estado } = contador();
    registerHandler(TIPO, handler);
    await nuevoEvento();

    const [resultado] = await runOnce(db);
    expect(resultado.result).toBe("processed");
    expect(estado.veces).toBe(1);

    const [evento] = await db.domainEvent.findMany({ where: { type: TIPO } });
    expect(evento.status).toBe("PROCESSED");
    expect(evento.processedAt).not.toBeNull();
  });

  it("ejecuta TODOS los manejadores registrados para el tipo", async () => {
    const uno = contador({ nombre: "uno" });
    const dos = contador({ nombre: "dos" });
    registerHandler(TIPO, uno.handler);
    registerHandler(TIPO, dos.handler);
    await nuevoEvento();

    await runOnce(db);
    expect(uno.estado.veces).toBe(1);
    expect(dos.estado.veces).toBe(1);
  });

  it("un evento sin manejador no se marca procesado ni se reintenta en bucle", async () => {
    // Marcarlo como procesado mentiría: nadie lo atendió.
    await nuevoEvento();
    const [resultado] = await runOnce(db);
    expect(resultado.result).toBe("unhandled");

    const [evento] = await db.domainEvent.findMany({ where: { type: TIPO } });
    expect(evento.status).toBe("PENDING");
    expect(evento.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });
});

describe("idempotencia — la entrega es AL MENOS una vez", () => {
  it("procesar dos veces el mismo evento deja el mismo estado final", async () => {
    // El manejador de ejemplo comprueba su propio rastro antes de actuar; aquí
    // se simula ese contrato: aplicar el efecto una sola vez aunque llegue dos.
    const aplicado = new Set<string>();
    let efectos = 0;
    registerHandler(TIPO, {
      name: "idempotente",
      async handle(e) {
        if (aplicado.has(e.id)) return; // el rastro ya está: no hacer nada
        aplicado.add(e.id);
        efectos += 1;
      },
    });

    const e = await nuevoEvento();
    const registro = { id: e.id, type: e.type, payload: e.payload, attempts: 0, createdAt: e.createdAt };

    await processEvent(registro, db);
    await processEvent(registro, db); // segunda entrega, como tras una caída

    expect(efectos).toBe(1);
  });

  it("un manejador NO idempotente duplicaría el efecto — por eso es requisito", async () => {
    // Prueba de contraste: documenta el daño que evita la regla.
    let efectos = 0;
    registerHandler(TIPO, {
      name: "descuidado",
      async handle() {
        efectos += 1;
      },
    });
    const e = await nuevoEvento();
    const registro = { id: e.id, type: e.type, payload: e.payload, attempts: 0, createdAt: e.createdAt };

    await processEvent(registro, db);
    await processEvent(registro, db);

    expect(efectos).toBe(2); // si esto fuera cashback, sería saldo regalado
  });
});

describe("reintentos y muerte", () => {
  it("un fallo devuelve el evento a la cola con espera y motivo", async () => {
    const { handler } = contador({ falla: true });
    registerHandler(TIPO, handler);
    await nuevoEvento();

    const [resultado] = await runOnce(db);
    expect(resultado.result).toBe("retry");

    const [evento] = await db.domainEvent.findMany({ where: { type: TIPO } });
    expect(evento.status).toBe("PENDING");
    expect(evento.attempts).toBe(1);
    expect(evento.lastError).toContain("fallo simulado");
    expect(evento.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("agotados los intentos el evento MUERE de forma terminal", async () => {
    const { handler } = contador({ falla: true });
    registerHandler(TIPO, handler);
    await nuevoEvento({ attempts: RETRY_POLICY.maxAttempts - 1 });

    const [resultado] = await runOnce(db);
    expect(resultado.result).toBe("dead");

    const [evento] = await db.domainEvent.findMany({ where: { type: TIPO } });
    expect(evento.status).toBe("FAILED");
    expect(evento.attempts).toBe(RETRY_POLICY.maxAttempts);
    expect(evento.lastError).toContain("fallo simulado");
  });

  it("un evento muerto ya no se vuelve a tomar", async () => {
    await nuevoEvento({ status: "FAILED", attempts: RETRY_POLICY.maxAttempts });
    const tomados = await claimBatch(db, 10);
    expect(tomados).toHaveLength(0);
  });

  it("un muerto solo revive por decisión explícita", async () => {
    const e = await nuevoEvento({ status: "FAILED", attempts: 5, lastError: "roto" });
    await retryDeadEvent(e.id);

    const despues = await db.domainEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(despues.status).toBe("PENDING");
    expect(despues.attempts).toBe(0);
    expect(despues.lastError).toBeNull();
  });

  it("no se puede 'reintentar' un evento que no está muerto", async () => {
    const e = await nuevoEvento();
    await expect(retryDeadEvent(e.id)).rejects.toThrow(/no muerto|PENDING/);
  });
});

describe("eventos huérfanos", () => {
  it("un evento tomado por un proceso que murió vuelve a estar disponible", async () => {
    await nuevoEvento({
      status: "PROCESSING",
      claimedAt: new Date(Date.now() - 10 * 60_000),
    });

    const recuperados = await recoverOrphans(db);
    expect(recuperados).toBe(1);

    const tomados = await claimBatch(db, 10);
    expect(tomados).toHaveLength(1);
  });

  it("un evento tomado hace un instante NO se considera huérfano", async () => {
    // Si el umbral fuera corto, se reprocesaría trabajo aún en curso.
    await nuevoEvento({ status: "PROCESSING", claimedAt: new Date() });
    expect(await recoverOrphans(db)).toBe(0);
  });
});

describe("diagnóstico", () => {
  it("distingue carga de atasco por la antigüedad del pendiente más viejo", async () => {
    const viejo = new Date(Date.now() - 3600_000);
    await nuevoEvento({ createdAt: viejo });
    await nuevoEvento();

    const h = await outboxHealth(db);
    expect(h.counts.pending).toBeGreaterThanOrEqual(2);
    expect(h.oldestPendingAgeSeconds).toBeGreaterThan(3000);
  });

  it("reporta los muertos con su motivo y los tipos sin manejador", async () => {
    await nuevoEvento({ status: "FAILED", attempts: 5, lastError: "se rompió" });
    await nuevoEvento(); // pendiente, sin manejador registrado

    const h = await outboxHealth(db);
    expect(h.counts.dead).toBeGreaterThanOrEqual(1);
    expect(h.dead.some((e) => e.lastError === "se rompió")).toBe(true);
    expect(h.unhandledTypes).toContain(TIPO);
  });

  it("un evento procesado deja de contar como pendiente", async () => {
    // Medido como diferencia y no en absoluto: la base de desarrollo puede
    // tener eventos reales, y una prueba que exija la bandeja vacía falla por
    // el entorno y no por el código.
    const antes = await outboxHealth(db);
    await nuevoEvento({ status: "PROCESSED", processedAt: new Date() });
    const despues = await outboxHealth(db);

    expect(despues.counts.processed).toBe(antes.counts.processed + 1);
    expect(despues.counts.pending).toBe(antes.counts.pending);
  });
});

describe("registro de manejadores", () => {
  it("rechaza dos manejadores con el mismo nombre para un tipo", () => {
    registerHandler(TIPO, contador({ nombre: "igual" }).handler);
    expect(() => registerHandler(TIPO, contador({ nombre: "igual" }).handler)).toThrow(
      /Ya hay un manejador/,
    );
  });
});
