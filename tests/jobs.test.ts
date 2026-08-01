// Trabajos programados. Lo crítico:
//   1. Un trabajo NUNCA corre encima de sí mismo — la expiración cancela
//      pedidos, y dos ejecuciones simultáneas compiten por el mismo.
//   2. La cadencia se mide desde la última ejecución, no desde el arranque:
//      así el programador resiste reinicios.
//   3. Un trabajo vencido varios intervalos corre UNA sola vez.
//   4. "Lleva demasiado sin correr" es detectable — es el fallo que de verdad
//      importa, porque un trabajo programado se apaga en silencio.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { JobDefinition } from "@/modules/jobs/definitions";
import { jobsStatus, haySenalDeAlarma, pruneJobRuns } from "@/modules/jobs/health";
import { isDue, runDueJobs, runJob } from "@/modules/jobs/scheduler";
import { canTransition } from "@/modules/orders/status";

const NOMBRE = "test:trabajo";

function trabajo(over: Partial<JobDefinition> = {}): JobDefinition {
  return {
    name: NOMBRE,
    description: "trabajo de prueba",
    everyMs: 60_000,
    timeoutMs: 5_000,
    async run() {
      return { summary: "hecho" };
    },
    ...over,
  } as JobDefinition;
}

async function limpiar() {
  await db.jobRun.deleteMany({
    where: { OR: [{ job: { startsWith: "test:" } }, { job: "orders:expire" }] },
  });
}

beforeEach(limpiar);
afterEach(limpiar);

describe("cadencia", () => {
  it("un trabajo sin ejecuciones siempre toca", async () => {
    expect(await isDue(trabajo(), db)).toBe(true);
  });

  it("no toca si corrió hace menos de su cadencia", async () => {
    await db.jobRun.create({
      data: { job: NOMBRE, result: "SUCCESS", startedAt: new Date(Date.now() - 10_000), finishedAt: new Date(Date.now() - 9_000) },
    });
    expect(await isDue(trabajo({ everyMs: 60_000 }), db)).toBe(false);
  });

  it("toca si ya pasó su cadencia", async () => {
    await db.jobRun.create({
      data: { job: NOMBRE, result: "SUCCESS", startedAt: new Date(Date.now() - 120_000), finishedAt: new Date(Date.now() - 119_000) },
    });
    expect(await isDue(trabajo({ everyMs: 60_000 }), db)).toBe(true);
  });

  it("una ejecución FALLIDA no cuenta como que corrió", async () => {
    // Si contara, un trabajo que falla siempre parecería estar al día.
    await db.jobRun.create({ data: { job: NOMBRE, result: "FAILURE", finishedAt: new Date() } });
    expect(await isDue(trabajo(), db)).toBe(true);
  });

  it("un trabajo vencido varios intervalos corre UNA sola vez", async () => {
    // Si el programador estuvo caído dos horas, la expiración corre una vez y
    // recoge todo lo vencido — no veinticuatro veces.
    let veces = 0;
    const t = trabajo({
      everyMs: 60_000,
      async run() {
        veces += 1;
        return { summary: "ok" };
      },
    });
    await db.jobRun.create({
      data: { job: NOMBRE, result: "SUCCESS", startedAt: new Date(Date.now() - 3600_000), finishedAt: new Date(Date.now() - 3599_000) },
    });

    await runDueJobs(db, [t]);
    await runDueJobs(db, [t]);

    expect(veces).toBe(1);
  });
});

describe("no solapamiento", () => {
  it("dos ejecuciones a la vez: una corre, la otra se omite", async () => {
    // El escenario del despliegue solapado: el contenedor viejo todavía no
    // murió y el nuevo ya arrancó. No es una hipótesis.
    let enCurso = 0;
    let maxSimultaneas = 0;
    const t = trabajo({
      async run() {
        enCurso += 1;
        maxSimultaneas = Math.max(maxSimultaneas, enCurso);
        await new Promise((r) => setTimeout(r, 300));
        enCurso -= 1;
        return { summary: "ok" };
      },
    });

    const [a, b] = await Promise.all([runJob(t, db), runJob(t, db)]);
    const resultados = [a.result, b.result].sort();

    expect(maxSimultaneas).toBe(1);
    expect(resultados).toEqual(["SKIPPED", "SUCCESS"]);
  });

  it("una omisión queda REGISTRADA, no se pierde", async () => {
    const t = trabajo({
      async run() {
        await new Promise((r) => setTimeout(r, 300));
        return { summary: "ok" };
      },
    });
    await Promise.all([runJob(t, db), runJob(t, db)]);

    const omitidas = await db.jobRun.count({ where: { job: NOMBRE, result: "SKIPPED" } });
    expect(omitidas).toBe(1);
  });
});

describe("registro de ejecuciones", () => {
  it("una ejecución con éxito guarda duración y resumen", async () => {
    await runJob(trabajo({ async run() { return { summary: "5 pedidos cancelados" }; } }), db);

    const r = await db.jobRun.findFirstOrThrow({ where: { job: NOMBRE } });
    expect(r.result).toBe("SUCCESS");
    expect(r.summary).toBe("5 pedidos cancelados");
    expect(r.finishedAt).not.toBeNull();
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("un fallo guarda el motivo y no borra el historial anterior", async () => {
    await runJob(trabajo(), db);
    await runJob(
      trabajo({
        async run(): Promise<{ summary: string }> {
          throw new Error("se rompió");
        },
      }),
      db,
    );

    const todas = await db.jobRun.findMany({ where: { job: NOMBRE }, orderBy: { startedAt: "asc" } });
    expect(todas).toHaveLength(2);
    expect(todas[0].result).toBe("SUCCESS");
    expect(todas[1].result).toBe("FAILURE");
    expect(todas[1].error).toContain("se rompió");
  });

  it("un trabajo que supera su tope se marca fallido por tiempo agotado", async () => {
    // Sin tope, un trabajo colgado retiene su cerrojo y omite en silencio todas
    // las ejecuciones siguientes.
    const r = await runJob(
      trabajo({
        timeoutMs: 100,
        async run() {
          await new Promise((res) => setTimeout(res, 2_000));
          return { summary: "nunca llega" };
        },
      }),
      db,
    );
    expect(r.result).toBe("FAILURE");
    expect(r.error).toMatch(/tope/);
  });
});

describe("aislamiento de fallos", () => {
  it("un trabajo que falla no impide que los demás corran", async () => {
    // Precisamente cuando algo va mal es cuando más falta hacen los otros.
    let corrioElBueno = false;
    const roto = trabajo({
      name: "test:roto",
      async run(): Promise<{ summary: string }> {
        throw new Error("roto");
      },
    });
    const bueno = trabajo({
      name: "test:bueno",
      async run() {
        corrioElBueno = true;
        return { summary: "ok" };
      },
    });

    const r = await runDueJobs(db, [roto, bueno]);
    expect(corrioElBueno).toBe(true);
    expect(r.find((x) => x.job === "test:roto")?.result).toBe("FAILURE");
    expect(r.find((x) => x.job === "test:bueno")?.result).toBe("SUCCESS");
  });
});

describe("diagnóstico", () => {
  it("distingue 'nunca corrió' de 'corrió y falló'", async () => {
    // Confundirlos haría que un despliegue recién hecho pareciera roto.
    const antes = await jobsStatus(db);
    for (const e of antes) expect(typeof e.neverRan).toBe("boolean");

    await db.jobRun.create({ data: { job: "orders:expire", result: "FAILURE", error: "x", finishedAt: new Date() } });
    const despues = await jobsStatus(db);
    const expira = despues.find((e) => e.job === "orders:expire")!;
    expect(expira.neverRan).toBe(false);
    expect(expira.lastResult).toBe("FAILURE");
    await db.jobRun.deleteMany({ where: { job: "orders:expire" } });
  });

  it("señala como atrasado lo que lleva mucho sin correr bien", async () => {
    await db.jobRun.create({
      data: {
        job: "orders:expire",
        result: "SUCCESS",
        startedAt: new Date(Date.now() - 24 * 3600_000),
        finishedAt: new Date(Date.now() - 24 * 3600_000 + 1000),
      },
    });
    const estados = await jobsStatus(db);
    const expira = estados.find((e) => e.job === "orders:expire")!;
    expect(expira.overdue).toBe(true);
    expect(haySenalDeAlarma(estados)).toBe(true);
    await db.jobRun.deleteMany({ where: { job: "orders:expire" } });
  });

  it("un trabajo recién ejecutado no está atrasado", async () => {
    await db.jobRun.create({ data: { job: "orders:expire", result: "SUCCESS", finishedAt: new Date() } });
    const estados = await jobsStatus(db);
    expect(estados.find((e) => e.job === "orders:expire")!.overdue).toBe(false);
    await db.jobRun.deleteMany({ where: { job: "orders:expire" } });
  });
});

describe("retención del historial", () => {
  it("borra lo antiguo pero NUNCA la última ejecución con éxito", async () => {
    // Si se borrara, un trabajo que lleva un mes sin correr parecería no haber
    // corrido nunca — que es un diagnóstico distinto.
    const viejo = new Date(Date.now() - 30 * 24 * 3600_000);
    await db.jobRun.create({ data: { job: "orders:expire", result: "SUCCESS", startedAt: viejo, finishedAt: viejo } });
    await db.jobRun.create({ data: { job: "orders:expire", result: "FAILURE", startedAt: viejo, finishedAt: viejo } });

    await pruneJobRuns(7, db);

    const quedan = await db.jobRun.findMany({ where: { job: "orders:expire" } });
    expect(quedan).toHaveLength(1);
    expect(quedan[0].result).toBe("SUCCESS");
    await db.jobRun.deleteMany({ where: { job: "orders:expire" } });
  });
});

describe("los trabajos respetan las reglas del dominio", () => {
  it("la transición que hace la expiración es una que la máquina de estados permite", () => {
    // `expireStaleOrders()` no llama a `canTransition()`: filtra por
    // `status: PENDING` en el WHERE y escribe CANCELLED. Eso es MÁS seguro que
    // consultar y luego escribir —no hay ventana entre la comprobación y la
    // escritura— pero solo si la transición es legítima. Esta prueba lo fija:
    // si alguien cambiara la máquina de estados para prohibir cancelar desde
    // pendiente, el trabajo empezaría a forzar un estado inválido en silencio.
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
  });

  it("la máquina de estados no permite cancelar desde estados avanzados", () => {
    // Y por eso el filtro por PENDING del trabajo importa: sin él, cancelaría
    // pedidos ya entregados.
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
  });
});
