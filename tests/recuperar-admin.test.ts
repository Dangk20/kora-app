// Recuperación de contraseña del panel.
// Ver src/modules/auth/reset.ts. Mismas reglas que la del comprador, más
// una: cambiarla invalida los JWT emitidos antes.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkPermission, PermissionError } from "@/modules/auth/permissions";
import { confirmUserPasswordReset, requestUserPasswordReset } from "@/modules/auth/reset";

const EMAIL = "zzt-admin-reset@prueba.local";
async function limpiar() {
  await db.user.deleteMany({ where: { email: EMAIL } });
}
async function usuario(active = true) {
  const rol = await db.role.findUniqueOrThrow({ where: { name: "admin" } });
  return db.user.create({ data: { email: EMAIL, name: "zzt", passwordHash: await bcrypt.hash("vieja-contrasena-1", 4), roleId: rol.id, active } });
}
beforeEach(limpiar);
afterEach(limpiar);

describe("pedir el código", () => {
  it("un usuario activo recibe código; uno inexistente o desactivado, la MISMA respuesta vacía", async () => {
    await usuario();
    const r = await requestUserPasswordReset(EMAIL);
    expect(r.codigo).toMatch(/^\d{6}$/);
    expect(await requestUserPasswordReset("nadie@prueba.local")).toEqual({ codigo: null, name: null });
    await limpiar(); await usuario(false);
    expect(await requestUserPasswordReset(EMAIL)).toEqual({ codigo: null, name: null });
  });
});

describe("confirmar", () => {
  it("cambia la contraseña con el código, y el código muere", async () => {
    const u = await usuario();
    const { codigo } = await requestUserPasswordReset(EMAIL);
    const ok = await confirmUserPasswordReset(EMAIL, codigo!, "nueva-contrasena-segura-1");
    expect(ok).toEqual({ ok: true });
    const despues = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await bcrypt.compare("nueva-contrasena-segura-1", despues.passwordHash)).toBe(true);
    expect(despues.passwordChangedAt).not.toBeNull();
    const otra = await confirmUserPasswordReset(EMAIL, codigo!, "otra-contrasena-segura-1");
    expect(otra.ok).toBe(false);
  });

  it("exige 12 caracteres: esta cuenta administra el negocio", async () => {
    await usuario();
    const { codigo } = await requestUserPasswordReset(EMAIL);
    const r = await confirmUserPasswordReset(EMAIL, codigo!, "corta");
    expect(r.ok).toBe(false);
    expect((r as { field?: string }).field).toBe("password");
  });

  it("un código equivocado gasta un intento y al sexto muere", async () => {
    await usuario();
    const { codigo } = await requestUserPasswordReset(EMAIL);
    const malo = codigo === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await confirmUserPasswordReset(EMAIL, malo, "nueva-contrasena-segura-1")).ok).toBe(false);
    // el bueno ya no sirve: se agotaron los intentos
    expect((await confirmUserPasswordReset(EMAIL, codigo!, "nueva-contrasena-segura-1")).ok).toBe(false);
  });
});

describe("cambiar la contraseña cierra las sesiones abiertas", () => {
  it("un JWT emitido ANTES del cambio deja de valer; uno de después, vale", async () => {
    const u = await usuario();
    const antes = Math.floor(Date.now() / 1000) - 60;
    await expect(checkPermission(u.id, "orders:view", antes)).resolves.toBeUndefined();

    const { codigo } = await requestUserPasswordReset(EMAIL);
    await confirmUserPasswordReset(EMAIL, codigo!, "nueva-contrasena-segura-1");

    await expect(checkPermission(u.id, "orders:view", antes)).rejects.toMatchObject({ reason: "SESSION_REVOKED" } satisfies Partial<PermissionError>);
    const despues = Math.floor(Date.now() / 1000) + 5;
    await expect(checkPermission(u.id, "orders:view", despues)).resolves.toBeUndefined();
  });
});
