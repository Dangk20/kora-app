// La ruleta de la apertura: un giro por cuenta y por celular, y todos ganan.
// Ver openspec/changes/ruleta-apertura.
//
// El premio lo decide el SERVIDOR, dentro de una transacción serializada con
// un candado consultivo: así dos giros simultáneos no se pasan del tope de un
// premio (p. ej. la única prenda de regalo). El navegador solo recibe la
// clave del premio y anima la ruleta hasta él.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { otorgarBeneficio } from "@/modules/benefits/benefits";
import { normalizarTelefono } from "@/modules/customers/phone";
import { PREMIOS, leerConfig, type ConfigRuleta, type PremioDef } from "./premios";

type Tx = Prisma.TransactionClient;

/** Número fijo del candado consultivo de la ruleta (pg_advisory_xact_lock). */
const CANDADO_RULETA = 4_207_011;

export type MotivoRuleta = "CERRADA" | "YA_GIRO" | "CELULAR_USADO" | "SIN_CELULAR" | "SIN_PREMIOS";

export type ResultadoGiro =
  | { ok: true; premio: string; titulo: string; benefitId: string; vence: Date }
  | { ok: false; motivo: MotivoRuleta };

export type EstadoRuleta = {
  activa: boolean;
  /** El celular de la cuenta, si tiene: con él se gira. */
  celular: string | null;
  giro: { premio: string; titulo: string; vence: Date } | null;
};

export async function estadoRuleta(customerId: string): Promise<EstadoRuleta> {
  const [config, cliente, giro] = await Promise.all([
    leerConfig(),
    db.customer.findUnique({ where: { id: customerId }, select: { phone: true } }),
    db.ruletaGiro.findUnique({ where: { customerId }, select: { premio: true, createdAt: true, benefit: { select: { title: true, expiresAt: true } } } }),
  ]);
  return {
    activa: config.activa,
    celular: cliente?.phone ?? null,
    giro: giro
      ? {
          premio: giro.premio,
          titulo: giro.benefit?.title ?? tituloDe(giro.premio),
          vence: giro.benefit?.expiresAt ?? giro.createdAt,
        }
      : null,
  };
}

function tituloDe(key: string): string {
  return PREMIOS.find((p) => p.key === key)?.titulo ?? key;
}

type Disponible = { def: PremioDef; peso: number; categoryIds?: string[]; variantId?: string };

/** Los premios que hoy se pueden ganar: con peso, sin tope agotado y con qué entregar. */
async function disponibles(t: Tx, config: ConfigRuleta): Promise<Disponible[]> {
  const conteo = await t.ruletaGiro.groupBy({ by: ["premio"], _count: { _all: true } });
  const ganados = new Map(conteo.map((c) => [c.premio, c._count._all]));
  const salida: Disponible[] = [];
  for (const def of PREMIOS) {
    const ajuste = config.premios[def.key];
    if (!ajuste || ajuste.peso <= 0) continue;
    if (ajuste.tope !== null && (ganados.get(def.key) ?? 0) >= ajuste.tope) continue;

    if (def.kind === "DESCUENTO_CATEGORIA") {
      const cats = await t.category.findMany({ where: { slug: { in: def.categorias ?? [] } }, select: { id: true, slug: true } });
      // En el orden del premio: la primera es la que nombra el beneficio.
      const ids = (def.categorias ?? []).map((s) => cats.find((c) => c.slug === s)?.id).filter((x): x is string => !!x);
      if (ids.length === 0) continue;
      salida.push({ def, peso: ajuste.peso, categoryIds: ids });
    } else if (def.kind === "PRODUCTO_GRATIS") {
      // Un regalo sin unidades en la tienda sería una promesa que la caja no
      // puede cumplir: deja de salir en cuanto se agota.
      const v = await t.variant.findFirst({
        where: { sku: def.sku, active: true, stockActual: { gt: 0 }, product: { active: true, archivedAt: null } },
        select: { id: true },
      });
      if (!v) continue;
      salida.push({ def, peso: ajuste.peso, variantId: v.id });
    } else {
      salida.push({ def, peso: ajuste.peso });
    }
  }
  return salida;
}

/** Elige por peso. `azar` en [0, 1): inyectable para las pruebas. */
export function elegir<T extends { peso: number }>(opciones: T[], azar: number): T {
  const total = opciones.reduce((s, o) => s + o.peso, 0);
  let punto = azar * total;
  for (const o of opciones) {
    if (punto < o.peso) return o;
    punto -= o.peso;
  }
  return opciones[opciones.length - 1];
}

export async function girar(
  customerId: string,
  celularEscrito?: string | null,
  opciones: { azar?: () => number; now?: Date } = {},
): Promise<ResultadoGiro> {
  const config = await leerConfig();
  if (!config.activa) return { ok: false, motivo: "CERRADA" };

  const cliente = await db.customer.findUnique({ where: { id: customerId }, select: { phone: true } });
  if (!cliente) return { ok: false, motivo: "SIN_CELULAR" };
  const celular = cliente.phone ?? normalizarTelefono(celularEscrito);
  if (!celular) return { ok: false, motivo: "SIN_CELULAR" };

  return db.$transaction(async (t) => {
    await t.$executeRaw`SELECT pg_advisory_xact_lock(${CANDADO_RULETA})`;

    const previo = await t.ruletaGiro.findFirst({
      where: { OR: [{ customerId }, { phone: celular }] },
      select: { customerId: true },
    });
    if (previo) return { ok: false, motivo: previo.customerId === customerId ? "YA_GIRO" : "CELULAR_USADO" };

    const opcionesHoy = await disponibles(t, config);
    if (opcionesHoy.length === 0) return { ok: false, motivo: "SIN_PREMIOS" };
    const gana = elegir(opcionesHoy, (opciones.azar ?? Math.random)());

    // Si la cuenta no tenía celular y este no es de nadie, se le guarda: es
    // el dato con el que la caja la va a buscar para entregarle el premio.
    if (!cliente.phone) {
      const deOtro = await t.customer.findFirst({ where: { phone: celular }, select: { id: true } });
      if (!deOtro) await t.customer.update({ where: { id: customerId }, data: { phone: celular } });
    }

    const [categoryId, ...extra] = gana.categoryIds ?? [];
    const b = await otorgarBeneficio(
      {
        customerId,
        kind: gana.def.kind,
        source: "RULETA",
        title: gana.def.titulo,
        amount: gana.def.monto,
        categoryId,
        extraCategoryIds: extra,
        variantId: gana.variantId,
        now: opciones.now,
      },
      t,
    );
    if (!b.ok) throw new Error(`La ruleta no pudo otorgar ${gana.def.key}: ${b.error}`);

    await t.ruletaGiro.create({ data: { customerId, phone: celular, premio: gana.def.key, benefitId: b.id } });
    const { expiresAt } = await t.benefit.findUniqueOrThrow({ where: { id: b.id }, select: { expiresAt: true } });
    return { ok: true, premio: gana.def.key, titulo: gana.def.titulo, benefitId: b.id, vence: expiresAt };
  });
}

export type ResumenRuleta = {
  giros: number;
  porPremio: Record<string, { ganados: number; usados: number }>;
};

/** Para el panel: cuántos giros y cuántos de cada premio se ganaron y usaron. */
export async function resumenRuleta(): Promise<ResumenRuleta> {
  const filas = await db.ruletaGiro.findMany({ select: { premio: true, benefit: { select: { usedAt: true } } } });
  const porPremio: ResumenRuleta["porPremio"] = Object.fromEntries(PREMIOS.map((p) => [p.key, { ganados: 0, usados: 0 }]));
  for (const f of filas) {
    porPremio[f.premio] ??= { ganados: 0, usados: 0 };
    porPremio[f.premio].ganados++;
    if (f.benefit?.usedAt) porPremio[f.premio].usados++;
  }
  return { giros: filas.length, porPremio };
}
