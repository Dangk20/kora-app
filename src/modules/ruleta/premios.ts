// Los premios de la ruleta de la apertura (propuesta enviada a KORA el 17 oct
// 2026). Ver openspec/changes/ruleta-apertura.
//
// QUÉ es cada premio vive aquí, en código: cambiar "10% en maquillaje" por
// otra cosa toca el beneficio que se otorga y merece una revisión. CUÁNTO
// sale cada uno (peso) y CUÁNTOS hay (tope) viven en `settings`, porque son
// las perillas que KORA mueve el día del evento sin desplegar.
//
// Las categorías y los productos se nombran por slug y SKU, no por id: los
// ids cambian entre la base de pruebas y la de producción.
import type { BenefitKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { esProduccion } from "@/lib/environment";

export type PremioDef = {
  key: string;
  /** Lo que se lee en la tajada: grande y, debajo, chico. */
  grande: string;
  chico: string;
  /** En la etiqueta del premio, debajo del número grande. */
  frase: string;
  /** El súper premio: tajada naranja con "Súper premio" encima. */
  super?: boolean;
  /** Lo que se lee en "Mis beneficios" y en el panel. */
  titulo: string;
  kind: BenefitKind;
  /** CASHBACK: pesos. DESCUENTO_CATEGORIA: porcentaje. */
  monto?: number;
  categorias?: string[];
  sku?: string;
  peso: number;
  /** Cuántos se pueden ganar en total. `null` = sin tope. */
  tope: number | null;
};

export const PREMIOS: PremioDef[] = [
  {
    key: "cashback-5000", grande: "$5.000", chico: "Cashback", frase: "en Kora Cashback", titulo: "$5.000 en Kora Cashback",
    kind: "CASHBACK", monto: 5000, peso: 35, tope: null,
  },
  {
    key: "maquillaje-10", grande: "10%", chico: "Maquillaje", frase: "de descuento en maquillaje y belleza", titulo: "10% en maquillaje y belleza",
    kind: "DESCUENTO_CATEGORIA", monto: 10, categorias: ["maquillaje-y-belleza"], peso: 25, tope: null,
  },
  {
    key: "ropa-15", grande: "15%", chico: "Ropa", frase: "de descuento en ropa", titulo: "15% en ropa",
    kind: "DESCUENTO_CATEGORIA", monto: 15,
    categorias: ["mujer", "hombre", "nina", "nino", "bebe-nina", "bebe-nino"], peso: 15, tope: null,
  },
  {
    key: "cashback-10000", grande: "$10.000", chico: "Cashback", frase: "en Kora Cashback", titulo: "$10.000 en Kora Cashback",
    kind: "CASHBACK", monto: 10000, peso: 13, tope: null,
  },
  {
    key: "labial-gratis", grande: "Labial", chico: "Gratis", frase: "Bálsamo labial Miss FactorX de regalo", titulo: "Bálsamo labial Miss FactorX de regalo",
    kind: "PRODUCTO_GRATIS", sku: "KFMB-0082", peso: 10, tope: 10,
  },
  {
    key: "strapless-gratis", grande: "Prenda", chico: "Gratis", frase: "Strapless New Look de regalo", super: true, titulo: "Strapless New Look de regalo",
    kind: "PRODUCTO_GRATIS", sku: "KMR-0044", peso: 2, tope: 1,
  },
];

export const RULETA_KEY = "ruleta";

export type AjustePremio = { peso: number; tope: number | null };
export type ConfigRuleta = { activa: boolean; premios: Record<string, AjustePremio> };

/** Cerrada en producción hasta que KORA la abra; abierta en pruebas y local. */
export function configPorOmision(env: NodeJS.ProcessEnv = process.env): ConfigRuleta {
  return {
    activa: !esProduccion(env),
    premios: Object.fromEntries(PREMIOS.map((p) => [p.key, { peso: p.peso, tope: p.tope }])),
  };
}

function entero(v: unknown, min: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= min ? n : null;
}

/** Lo guardado manda sobre lo de fábrica, premio por premio y valor por valor. */
export async function leerConfig(): Promise<ConfigRuleta> {
  const base = configPorOmision();
  const fila = await db.setting.findUnique({ where: { key: RULETA_KEY } });
  const v = (fila?.value ?? {}) as { activa?: unknown; premios?: Record<string, { peso?: unknown; tope?: unknown }> };
  const premios = { ...base.premios };
  for (const p of PREMIOS) {
    const g = v.premios?.[p.key];
    if (!g) continue;
    premios[p.key] = {
      peso: entero(g.peso, 0) ?? base.premios[p.key].peso,
      tope: g.tope === null ? null : (entero(g.tope, 0) ?? base.premios[p.key].tope),
    };
  }
  return { activa: typeof v.activa === "boolean" ? v.activa : base.activa, premios };
}

export async function guardarConfig(config: ConfigRuleta): Promise<void> {
  await db.setting.upsert({
    where: { key: RULETA_KEY },
    create: { key: RULETA_KEY, value: config },
    update: { value: config },
  });
}
