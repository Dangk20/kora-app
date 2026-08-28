// Seguimiento del pedido SIN cuenta (alcance §1.9).
//
// Lo que se fija aquí es sobre todo quién NO puede ver un pedido. El número es
// un autoincremento: quien tiene el suyo tiene el del vecino, así que la
// pantalla se sostiene entera sobre el segundo dato y sobre la firma.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  TRACKING_NOT_FOUND,
  findOrderForTracking,
  parseOrderNumber,
  trackingToken,
  verifyTrackingToken,
} from "@/modules/orders/tracking";
import { unsubscribeToken } from "@/modules/consent/token";

const PREFIJO = "ZZTRACK";

async function limpiar() {
  await db.order.deleteMany({ where: { contactName: { startsWith: PREFIJO } } });
}

async function pedido(over: Record<string, unknown> = {}) {
  return db.order.create({
    data: {
      channel: "WEB",
      contactName: `${PREFIJO} Comprador`,
      contactEmail: "quien-compro@ejemplo.com",
      contactPhone: "+573105557788",
      currency: "COP",
      subtotal: 100_000,
      total: 100_000,
      checkoutToken: `${PREFIJO}-${Math.random().toString(36).slice(2)}`,
      ...over,
    },
  });
}

beforeEach(limpiar);
afterEach(limpiar);

describe("quién puede ver un pedido", () => {
  it("con el número Y el correo del pedido, se encuentra", async () => {
    const o = await pedido();
    const r = await findOrderForTracking(o.number, "quien-compro@ejemplo.com");
    expect(r?.id).toBe(o.id);
  });

  it("el correo no distingue mayúsculas", async () => {
    const o = await pedido();
    const r = await findOrderForTracking(o.number, "  Quien-Compro@Ejemplo.COM  ");
    expect(r?.id).toBe(o.id);
  });

  it("también sirve el celular, escrito como se escriba", async () => {
    // El comprador no tiene por qué recordar si puso correo o teléfono.
    const o = await pedido();
    for (const forma of ["3105557788", "+573105557788", "310 555 7788"]) {
      const r = await findOrderForTracking(o.number, forma);
      expect(r?.id, `no encontró con '${forma}'`).toBe(o.id);
    }
  });

  it("🔒 el número SOLO no basta: sin el contacto correcto no se encuentra", async () => {
    // Es la garantía central. `orders.number` es un autoincremento: si bastara,
    // contando de uno en uno se leerían nombre, teléfono, dirección y compras
    // de todos los clientes.
    const o = await pedido();
    const r = await findOrderForTracking(o.number, "otro@ejemplo.com");
    expect(r).toBeNull();
  });

  it("🔒 el contacto correcto sobre OTRO número tampoco sirve", async () => {
    const mio = await pedido();
    const ajeno = await pedido({ contactEmail: "ajeno@ejemplo.com", contactPhone: "+573009998877" });

    const r = await findOrderForTracking(ajeno.number, "quien-compro@ejemplo.com");
    expect(r).toBeNull();
    expect(mio.number).not.toBe(ajeno.number);
  });

  it("🔒 un correo no se convierte en un teléfono buscable", async () => {
    // `toE164` normaliza lo que le den: sobre un correo devolvería "+57", que
    // es un valor de búsqueda real. Un `where` con basura plausible es peor que
    // uno sin la condición.
    await pedido({ contactPhone: "+57" });
    const r = await findOrderForTracking(1, "no-es-un-telefono@ejemplo.com");
    expect(r).toBeNull();
  });

  it("un contacto vacío nunca encuentra nada", async () => {
    const o = await pedido();
    expect(await findOrderForTracking(o.number, "   ")).toBeNull();
  });
});

describe("el token firmado", () => {
  it("ida y vuelta: se verifica el pedido que se firmó", () => {
    expect(verifyTrackingToken(trackingToken("pedido-123"))).toBe("pedido-123");
  });

  it("🔒 una firma alterada no vale", () => {
    const t = trackingToken("pedido-123");
    const roto = `${t.slice(0, -1)}${t.at(-1) === "a" ? "b" : "a"}`;
    expect(verifyTrackingToken(roto)).toBeNull();
  });

  it("🔒 no se puede firmar otro pedido reusando una firma ajena", () => {
    const ajeno = trackingToken("pedido-999").split(".")[1];
    expect(verifyTrackingToken(`pedido-123.${ajeno}`)).toBeNull();
  });

  it("🔒 un token de BAJA no sirve para ver un pedido", () => {
    // Los dos usan el mismo secreto del despliegue. Sin el prefijo de propósito
    // en la firma, ambos firmarían la misma cadena y serían intercambiables:
    // quien recibiera un correo de campaña podría convertir su enlace de baja
    // en acceso a un pedido.
    const baja = unsubscribeToken("cliente-abc");
    expect(verifyTrackingToken(baja)).toBeNull();
  });

  it("basura no revienta, devuelve null", () => {
    for (const t of ["", ".", "sinpunto", "a.b.c", "...."]) {
      expect(verifyTrackingToken(t)).toBeNull();
    }
  });
});

describe("el número, tal como el comprador lo tiene delante", () => {
  it("acepta el formato que la propia tienda imprime", () => {
    // El año va dentro: juntar todos los dígitos daría 2026000004.
    expect(parseOrderNumber("KO-2026-00004")).toBe(4);
  });

  it("acepta también el número pelado", () => {
    expect(parseOrderNumber("4")).toBe(4);
    expect(parseOrderNumber("  00042 ")).toBe(42);
  });

  it("lo que no es un número devuelve null", () => {
    for (const v of ["", "KO-2026-", "abc", "-", "0"]) {
      expect(parseOrderNumber(v), `'${v}' debería ser null`).toBeNull();
    }
  });
});

describe("el mensaje de 'no encontrado'", () => {
  it("es UNO solo, y no distingue qué falló", () => {
    // Distinguir "ese pedido no existe" de "los datos no coinciden" convertiría
    // la pantalla en un buscador de clientes.
    expect(TRACKING_NOT_FOUND).not.toMatch(/no existe|incorrect|no coincide/i);
    expect(TRACKING_NOT_FOUND).toContain("No encontramos un pedido con esos datos");
  });
});
