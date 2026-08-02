// LA MATRIZ DE PERMISOS — única fuente de verdad, y se aplica en cada despliegue.
//
// ⚠️ Vive aquí y no en el seed por una razón que ya costó caro: el seed solo
// corre en bases NUEVAS, y el despliegue solo aplica MIGRACIONES. Un permiso
// añadido a la matriz nunca llegaba a un entorno que ya existía — el módulo
// quedaba invisible en el menú y su pantalla redirigía al panel, sin ningún
// error. Le pasó a Cupones y a Ventas a la vez: construidos, probados,
// desplegados y sin forma de abrirlos.
//
// Ahora el contenedor de migraciones ejecuta `sync-rbac.ts` justo después de
// migrar, así que la base SIEMPRE termina pareciéndose a esta matriz.
//
// Está en `prisma/` a propósito: es lo único que la imagen `migrator` copia
// además del esquema. Si se moviera a `src/modules/`, habría que engordar esa
// imagen o duplicar la matriz — y dos matrices es exactamente el problema que
// esto resuelve.

import type { PrismaClient } from "../src/generated/prisma/client";

export const MATRIX: Record<string, string[]> = {
  catalog: ["view", "create", "edit", "delete"],
  inventory: ["view", "adjust"],
  orders: ["view", "create", "edit", "confirm", "cancel"],
  // "sales" es distinto de "orders" a propósito: ver pedidos es atender; ver
  // ventas es ver cuánto factura el negocio. El cajero necesita lo primero y no
  // tiene por qué saber lo segundo.
  sales: ["view", "export"],
  pos: ["view", "sell"],
  // "customers" y NO "crm": la nomenclatura acordada con el cliente prohíbe esa
  // palabra — un CRM implica un alcance mucho mayor del que se vendió.
  customers: ["view", "create", "edit", "export"],
  coupons: ["view", "create", "edit"],
  dashboard: ["view"],
  loyalty: ["view", "adjust"],
  marketing: ["view", "create", "send"],
  users: ["view", "create", "edit", "delete"],
  settings: ["view", "edit"],
};

export const ROLES: Record<string, { description: string; grants: string[] | "ALL" }> = {
  admin: { description: "Acceso total", grants: "ALL" },
  operador: {
    description: "Opera pedidos, inventario y clientes",
    grants: [
      "catalog:view", "catalog:edit",
      "inventory:view", "inventory:adjust",
      "orders:view", "orders:create", "orders:edit", "orders:confirm", "orders:cancel",
      "customers:view", "customers:create", "customers:edit",
      "coupons:view", "coupons:create", "coupons:edit",
      "dashboard:view", "loyalty:view",
      // Ve la facturación, pero NO puede sacarla del sistema: exportar es
      // llevarse los datos del negocio, y eso queda en el administrador.
      "sales:view",
    ],
  },
  cajero: {
    description: "Punto de venta",
    grants: ["pos:view", "pos:sell", "catalog:view", "orders:view"],
  },
  marketing: {
    description: "Campañas y clientes",
    grants: [
      "customers:view", "customers:export",
      "marketing:view", "marketing:create", "marketing:send",
      "dashboard:view", "sales:view",
    ],
  },
};

export type RbacSyncResult = {
  permisosCreados: string[];
  concedidos: { rol: string; permiso: string }[];
  revocados: { rol: string; permiso: string }[];
};

/**
 * Deja la base igual a la matriz. Idempotente: correrla dos veces no cambia nada.
 *
 * Añade los permisos que faltan y ajusta las concesiones de cada rol para que
 * coincidan EXACTAMENTE con lo declarado — también revoca lo que sobra, porque
 * un permiso retirado de la matriz que siguiera concedido sería justo el tipo
 * de acceso que nadie recuerda haber dado.
 *
 * NO borra filas de `permissions` que ya no estén en la matriz: pueden estar
 * referenciadas y su daño real —seguir concedidas— ya queda resuelto al
 * revocarlas.
 */
export async function syncRbac(db: PrismaClient): Promise<RbacSyncResult> {
  const res: RbacSyncResult = { permisosCreados: [], concedidos: [], revocados: [] };

  const permIds = new Map<string, string>();
  for (const [module, actions] of Object.entries(MATRIX)) {
    for (const action of actions) {
      const clave = `${module}:${action}`;
      const existente = await db.permission.findUnique({
        where: { module_action: { module, action } },
        select: { id: true },
      });
      if (existente) {
        permIds.set(clave, existente.id);
        continue;
      }
      const creado = await db.permission.create({ data: { module, action } });
      permIds.set(clave, creado.id);
      res.permisosCreados.push(clave);
    }
  }

  for (const [name, def] of Object.entries(ROLES)) {
    const role = await db.role.upsert({
      where: { name },
      update: { description: def.description },
      create: { name, description: def.description },
    });

    const deseados = new Set(def.grants === "ALL" ? [...permIds.keys()] : def.grants);
    for (const clave of deseados) {
      if (!permIds.has(clave)) throw new Error(`Permiso inexistente en la matriz: ${clave}`);
    }

    const actuales = await db.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: { select: { module: true, action: true } } },
    });
    const actualesPorClave = new Map(
      actuales.map((rp) => [`${rp.permission.module}:${rp.permission.action}`, rp.permissionId]),
    );

    for (const clave of deseados) {
      if (actualesPorClave.has(clave)) continue;
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: permIds.get(clave)! },
      });
      res.concedidos.push({ rol: name, permiso: clave });
    }

    for (const [clave, permissionId] of actualesPorClave) {
      if (deseados.has(clave)) continue;
      await db.rolePermission.delete({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
      });
      res.revocados.push({ rol: name, permiso: clave });
    }
  }

  return res;
}
