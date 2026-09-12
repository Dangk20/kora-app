// Consumo del plan del proveedor: cuánto ha salido hoy y este mes, contra
// qué límite. Ver openspec/changes/consumo-y-metricas-de-correo — specs/email-usage.
//
// El proveedor no expone su contador y la clave es de solo envío, así que la
// cuenta es NUESTRA: `provider_sends`, escrita por el driver contable. Es exacta
// mientras todo correo pase por KORA — que es el caso.
//
// ⚠️ DÍA Y MES EN UTC, no en Bogotá. El proveedor corta por su reloj; contar
// en Bogotá adelantaría el corte cinco horas y haría creer que queda cupo que
// ya no queda. `business-time.ts` es para el negocio, no para esto.

import { db } from "@/lib/db";

/** Los del plan gratuito de Resend, citados de memoria: confirmarlos en su panel. */
export const DEFAULT_DAILY_LIMIT = 100;
export const DEFAULT_MONTHLY_LIMIT = 3000;

export type EmailLimits = { daily: number; monthly: number };

export function emailLimits(env: NodeJS.ProcessEnv = process.env): EmailLimits {
  const leer = (name: string, porDefecto: number) => {
    const n = Number(env[name]?.trim());
    return Number.isInteger(n) && n > 0 ? n : porDefecto;
  };
  return {
    daily: leer("KORA_EMAIL_DAILY_LIMIT", DEFAULT_DAILY_LIMIT),
    monthly: leer("KORA_EMAIL_MONTHLY_LIMIT", DEFAULT_MONTHLY_LIMIT),
  };
}

export type EmailUsage = {
  today: number;
  month: number;
  limits: EmailLimits;
  /** Cuántos caben todavía. Nunca negativo. */
  remainingToday: number;
  remainingMonth: number;
};

export function inicioDelDiaUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function inicioDelMesUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function emailUsage(now = new Date(), env = process.env): Promise<EmailUsage> {
  const limits = emailLimits(env);
  const [today, month] = await Promise.all([
    db.providerSend.count({ where: { sentAt: { gte: inicioDelDiaUtc(now) } } }),
    db.providerSend.count({ where: { sentAt: { gte: inicioDelMesUtc(now) } } }),
  ]);
  return {
    today,
    month,
    limits,
    remainingToday: Math.max(0, limits.daily - today),
    remainingMonth: Math.max(0, limits.monthly - month),
  };
}

export type QuotaCheck =
  | { fits: "yes" }
  | { fits: "partial"; today: number; later: number }
  | { fits: "no"; remainingMonth: number };

/**
 * ¿Cabe una audiencia en lo que queda?
 *
 * No cabe en el MES → no arranca: nunca terminaría. Cabe en el mes pero no en
 * el DÍA → avisa: el módulo ya drena en días sucesivos ante un rechazo por
 * cupo, lo que falta es que el operador lo sepa ANTES y no a la mañana
 * siguiente, cuando descubre que la mitad no salió.
 */
export function checkQuota(audience: number, usage: EmailUsage): QuotaCheck {
  if (audience > usage.remainingMonth) return { fits: "no", remainingMonth: usage.remainingMonth };
  if (audience > usage.remainingToday) {
    return { fits: "partial", today: usage.remainingToday, later: audience - usage.remainingToday };
  }
  return { fits: "yes" };
}
