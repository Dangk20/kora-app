// A quién le llega una campaña.
// Ver openspec/changes/email-marketing — specs/email-campaigns y email-consent.
//
// La elegibilidad se comprueba DOS VECES: aquí, al armar la audiencia, y otra
// vez al enviar cada lote (`dispatch.ts`). Entre las dos pueden pasar horas, y
// alguien que se da de baja en ese intervalo y aun así recibe el correo tiene
// razón en quejarse — y esa queja pesa más que la baja, porque la registra el
// proveedor de correo del destinatario contra el dominio entero.

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { CONFIRMED_SQL_LIST, confirmedFilter } from "@/modules/customers/confirmed";
import { ACTIVIDAD_LABEL, type Segment } from "./types";

// Los tipos y constantes viven en `types.ts`, sin dependencias, porque el
// formulario del panel es un componente de cliente y este archivo importa
// Prisma. Se re-exportan para que quien ya los usaba no cambie.
export {
  SEGMENTO_VACIO,
  type AccountFilter,
  type ActivityFilter,
  type CountryFilter,
  type Segment,
} from "./types";

const DIAS: Record<string, number> = { activos_30: 30, activos_60: 60, activos_90: 90 };

function desde(dias: number, now: Date): Date {
  return new Date(now.getTime() - dias * 24 * 3600_000);
}

/**
 * Base elegible, SIEMPRE: suscrito, con correo y con el correo utilizable.
 *
 * No es un filtro más — es la condición previa a cualquier segmento, y por eso
 * vive aparte y no se puede desactivar desde el panel.
 */
function baseElegible(): Prisma.CustomerWhereInput {
  return {
    acceptsMarketing: true,
    emailUsable: true,
    email: { not: null },
  };
}

/** Traduce el segmento a una condición de Prisma. Los filtros intersectan. */
export function segmentWhere(segment: Segment, now = new Date()): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [baseElegible()];

  if (segment.country !== "ambos") and.push({ country: segment.country });

  switch (segment.activity) {
    case "sin_compras":
      and.push({ orders: { none: confirmedFilter } });
      break;
    case "inactivos_90":
      // Compró alguna vez, pero no en los últimos 90 días.
      and.push({ orders: { some: confirmedFilter } });
      and.push({
        orders: { none: { ...confirmedFilter, createdAt: { gte: desde(90, now) } } },
      });
      break;
    case "todos":
      break;
    default:
      and.push({
        orders: { some: { ...confirmedFilter, createdAt: { gte: desde(DIAS[segment.activity], now) } } },
      });
  }

  if (segment.account === "con_cuenta") and.push({ passwordHash: { not: null } });
  if (segment.account === "invitados") and.push({ passwordHash: null });

  return { AND: and };
}

/**
 * Cuántos destinatarios tiene el segmento.
 *
 * Se cuenta con agregación, no trayendo filas: es el número que el panel
 * recalcula cada vez que el operador toca un filtro, y es también el único
 * freno que tiene antes de enviarle a toda la base.
 */
export async function countAudience(segment: Segment, now = new Date()): Promise<number> {
  if (segment.categoryIds.length === 0) {
    return db.customer.count({ where: segmentWhere(segment, now) });
  }
  return (await audienceIds(segment, now)).length;
}

/** Clientes que compraron (confirmado) algo de esas categorías. */
async function compradoresDeCategorias(categoryIds: string[]): Promise<Set<string>> {
  const filas = await db.$queryRawUnsafe<{ customerId: string }[]>(
    `SELECT DISTINCT o."customerId" AS "customerId"
     FROM order_items oi
     JOIN orders o     ON o.id = oi."orderId"
     JOIN variants v   ON v.id = oi."variantId"
     JOIN products p   ON p.id = v."productId"
     WHERE o.status IN (${CONFIRMED_SQL_LIST})
       AND o."customerId" IS NOT NULL
       AND p."categoryId" = ANY($1::text[])`,
    categoryIds,
  );
  return new Set(filas.map((f) => f.customerId));
}

/** Los identificadores de la audiencia, ya intersectados. */
export async function audienceIds(segment: Segment, now = new Date()): Promise<string[]> {
  const clientes = await db.customer.findMany({
    where: segmentWhere(segment, now),
    select: { id: true },
  });
  if (segment.categoryIds.length === 0) return clientes.map((c) => c.id);

  // Sin memoria entre llamadas a propósito: un caché a nivel de módulo se
  // comparte entre peticiones y entre operadores, y aquí devolver una audiencia
  // rancia significa enviarle a quien acaba de darse de baja. La consulta es
  // una agregación indexada; el ahorro no compensa el riesgo.
  const compradores = await compradoresDeCategorias(segment.categoryIds);
  return clientes.map((c) => c.id).filter((id) => compradores.has(id));
}

export type AudienceMember = { id: string; email: string; name: string };

/**
 * La audiencia con los datos que se congelan.
 *
 * El correo se copia tal como está ahora: el cliente puede corregirlo después,
 * y el registro tiene que decir a dónde se envió de verdad, no a dónde se
 * enviaría hoy.
 */
export async function audienceMembers(
  segment: Segment,
  now = new Date(),
): Promise<AudienceMember[]> {
  const ids = await audienceIds(segment, now);
  if (ids.length === 0) return [];
  const clientes = await db.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, name: true },
  });
  return clientes
    .filter((c): c is typeof c & { email: string } => Boolean(c.email))
    .map((c) => ({ id: c.id, email: c.email, name: c.name }));
}

/** Descripción legible del segmento, para el listado del panel. */
export function describeSegment(segment: Segment, categoryNames: string[] = []): string {
  const partes: string[] = [];
  partes.push(segment.country === "ambos" ? "CO + US" : segment.country);

  partes.push(ACTIVIDAD_LABEL[segment.activity]);

  if (segment.account !== "todos") {
    partes.push(segment.account === "con_cuenta" ? "con cuenta" : "invitados");
  }
  if (categoryNames.length > 0) partes.push(categoryNames.join(", "));
  return partes.join(" · ");
}
