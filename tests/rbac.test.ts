// La matriz RBAC no es decorativa: estos tests fijan qué puede hacer cada rol.
// Si un cambio de seed o de código altera la matriz, esto revienta.
import bcrypt from "bcryptjs";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkPermission, PermissionError } from "@/modules/auth/permissions";
import { verifyCredentials } from "@/modules/auth/verify";

const TEST_EMAIL = "test-rbac-cajero@kora.local";
const TEST_PASSWORD = "test-rbac-12345678";

async function createTestUser(roleName: string, active = true) {
  const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
  return db.user.upsert({
    where: { email: TEST_EMAIL },
    update: { roleId: role.id, active },
    create: {
      email: TEST_EMAIL,
      name: "Test Cajero",
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      roleId: role.id,
      active,
    },
  });
}

afterAll(async () => {
  await db.user.deleteMany({ where: { email: TEST_EMAIL } });
  await db.$disconnect();
});

describe("matriz de permisos por rol", () => {
  it("admin tiene todos los permisos", async () => {
    const [total, adminGrants] = await Promise.all([
      db.permission.count(),
      db.rolePermission.count({ where: { role: { name: "admin" } } }),
    ]);
    expect(total).toBeGreaterThan(0);
    expect(adminGrants).toBe(total);
  });

  it("cajero tiene exactamente su set (POS + lectura)", async () => {
    const grants = await db.rolePermission.findMany({
      where: { role: { name: "cajero" } },
      include: { permission: true },
    });
    const keys = grants.map((g) => `${g.permission.module}:${g.permission.action}`).sort();
    expect(keys).toEqual(["catalog:view", "orders:view", "pos:sell", "pos:view"]);
  });

  it("marketing no puede confirmar pedidos ni tocar usuarios", async () => {
    const grants = await db.rolePermission.findMany({
      where: { role: { name: "marketing" } },
      include: { permission: true },
    });
    const keys = grants.map((g) => `${g.permission.module}:${g.permission.action}`);
    expect(keys).not.toContain("orders:confirm");
    expect(keys.some((k) => k.startsWith("users:"))).toBe(false);
  });

  it("operador puede confirmar pedidos (el evento central del negocio)", async () => {
    const grant = await db.rolePermission.findFirst({
      where: {
        role: { name: "operador" },
        permission: { module: "orders", action: "confirm" },
      },
    });
    expect(grant).not.toBeNull();
  });
});

describe("checkPermission (verificación contra la base)", () => {
  it("permite lo concedido y niega lo demás", async () => {
    const user = await createTestUser("cajero");
    await expect(checkPermission(user.id, "pos:sell")).resolves.toBeUndefined();
    await expect(checkPermission(user.id, "users:view")).rejects.toThrow(PermissionError);
    await expect(checkPermission(user.id, "orders:confirm")).rejects.toThrow(/FORBIDDEN/);
  });

  it("usuario desactivado pierde todo acceso de inmediato", async () => {
    const user = await createTestUser("cajero", false);
    await expect(checkPermission(user.id, "pos:sell")).rejects.toThrow(/INACTIVE/);
  });
});

describe("verifyCredentials", () => {
  it("credenciales correctas devuelven usuario con rol y permisos", async () => {
    await createTestUser("cajero");
    const result = await verifyCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(result?.role).toBe("cajero");
    expect(result?.permissions).toContain("pos:sell");
  });

  it("contraseña incorrecta devuelve null", async () => {
    await createTestUser("cajero");
    expect(await verifyCredentials(TEST_EMAIL, "incorrecta")).toBeNull();
  });

  it("usuario inactivo no puede iniciar sesión", async () => {
    await createTestUser("cajero", false);
    expect(await verifyCredentials(TEST_EMAIL, TEST_PASSWORD)).toBeNull();
  });
});
