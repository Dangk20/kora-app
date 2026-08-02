// La matriz RBAC no es decorativa: estos tests fijan qué puede hacer cada rol.
// Si un cambio de seed o de código altera la matriz, esto revienta.
import bcrypt from "bcryptjs";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkPermission, PermissionError } from "@/modules/auth/permissions";
import { verifyCredentials } from "@/modules/auth/verify";
import { MATRIX, ROLES, syncRbac } from "../prisma/rbac";

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

  it("LA FACTURACIÓN NO ES PARA TODOS: el cajero no ve ventas, el operador no las exporta", async () => {
    // Ver pedidos es atender; ver ventas es saber cuánto factura el negocio.
    // Y exportar es llevarse esos datos fuera del sistema: eso solo el admin.
    const de = async (rol: string) => {
      const grants = await db.rolePermission.findMany({
        where: { role: { name: rol } },
        include: { permission: true },
      });
      return grants.map((g) => `${g.permission.module}:${g.permission.action}`);
    };

    const cajero = await de("cajero");
    expect(cajero).toContain("orders:view");
    expect(cajero).not.toContain("sales:view");

    const operador = await de("operador");
    expect(operador).toContain("sales:view");
    expect(operador).not.toContain("sales:export");

    const admin = await de("admin");
    expect(admin).toContain("sales:export");
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

  it("MARKETING puede enviar campañas; el operador NO", async () => {
    // `marketing:send` está separado de `marketing:create` a propósito:
    // componer una campaña y dispararle un correo a toda la base de clientes no
    // son el mismo nivel de responsabilidad. Un envío no se puede deshacer.
    const claves = async (rol: string) => {
      const grants = await db.rolePermission.findMany({
        where: { role: { name: rol } },
        include: { permission: true },
      });
      return grants.map((g) => `${g.permission.module}:${g.permission.action}`);
    };

    const marketing = await claves("marketing");
    expect(marketing).toContain("marketing:view");
    expect(marketing).toContain("marketing:create");
    expect(marketing).toContain("marketing:send");

    const operador = await claves("operador");
    expect(operador.some((k) => k.startsWith("marketing:"))).toBe(false);

    const cajero = await claves("cajero");
    expect(cajero.some((k) => k.startsWith("marketing:"))).toBe(false);
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

describe("nomenclatura de la matriz de permisos", () => {
  it('NO existe ningún módulo llamado "crm"', async () => {
    // El acuerdo con el cliente (18 jul 2026) prohíbe la palabra "CRM": nombra
    // un producto mucho más grande del que se vendió. Esta prueba impide que
    // vuelva por descuido — un permiso acaba apareciendo en pantallas de
    // administración y en conversaciones.
    const crm = await db.permission.findMany({ where: { module: "crm" } });
    expect(crm).toHaveLength(0);
  });

  it('existe el módulo "customers" con sus cuatro acciones', async () => {
    const perms = await db.permission.findMany({ where: { module: "customers" } });
    expect(perms.map((p) => p.action).sort()).toEqual(["create", "edit", "export", "view"]);
  });
});

// ─────────────────────────────────────────────────────────────
describe("LA MATRIZ LLEGA A LA BASE EN CADA DESPLIEGUE", () => {
  // Esto existe por un fallo real: la matriz vivía solo en el seed, que únicamente
  // corre en bases NUEVAS, y el despliegue solo aplica migraciones. Cupones y
  // Ventas quedaron invisibles en pruebas —desplegados, probados, sin forma de
  // abrirlos— y sin ningún error que mirar. Ahora el contenedor de migraciones
  // sincroniza, y esto lo fija.

  it("todo permiso de la matriz existe en la base", async () => {
    const enBase = new Set(
      (await db.permission.findMany({ select: { module: true, action: true } })).map(
        (p) => `${p.module}:${p.action}`,
      ),
    );
    const faltan: string[] = [];
    for (const [modulo, acciones] of Object.entries(MATRIX)) {
      for (const accion of acciones) {
        if (!enBase.has(`${modulo}:${accion}`)) faltan.push(`${modulo}:${accion}`);
      }
    }
    expect(faltan, `permisos de la matriz que no llegaron a la base: ${faltan.join(", ")}`).toEqual([]);
  });

  it("cada rol tiene EXACTAMENTE lo que declara la matriz", async () => {
    for (const [nombre, def] of Object.entries(ROLES)) {
      const grants = await db.rolePermission.findMany({
        where: { role: { name: nombre } },
        include: { permission: true },
      });
      const enBase = grants
        .map((g) => `${g.permission.module}:${g.permission.action}`)
        .sort();
      const esperados = (
        def.grants === "ALL"
          ? Object.entries(MATRIX).flatMap(([m, as]) => as.map((a) => `${m}:${a}`))
          : def.grants
      ).sort();
      expect(enBase, `el rol ${nombre} no coincide con la matriz`).toEqual(esperados);
    }
  });

  it("SINCRONIZAR DOS VECES no cambia nada: es idempotente", async () => {
    // El despliegue la corre en cada migración. Si no fuera idempotente,
    // cada despliegue movería permisos.
    const segunda = await syncRbac(db);
    expect(segunda.permisosCreados).toEqual([]);
    expect(segunda.concedidos).toEqual([]);
    expect(segunda.revocados).toEqual([]);
  });

  it("REVOCA lo que sobra: un permiso quitado de la matriz no se queda concedido", async () => {
    // Un acceso que nadie recuerda haber dado es peor que uno que falta.
    const rol = await db.role.findUniqueOrThrow({ where: { name: "cajero" } });
    const sobrante = await db.permission.findFirstOrThrow({
      where: { module: "users", action: "delete" },
    });
    await db.rolePermission.create({
      data: { roleId: rol.id, permissionId: sobrante.id },
    });

    const r = await syncRbac(db);

    expect(r.revocados).toContainEqual({ rol: "cajero", permiso: "users:delete" });
    const sigue = await db.rolePermission.findFirst({
      where: { roleId: rol.id, permissionId: sobrante.id },
    });
    expect(sigue).toBeNull();
  });
});
