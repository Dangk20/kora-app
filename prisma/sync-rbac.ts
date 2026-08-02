// Aplica la matriz de permisos a la base: pnpm rbac:sync
//
// Lo ejecuta el CONTENEDOR DE MIGRACIONES en cada despliegue, justo después de
// migrar. No es opcional ni una tarea de mantenimiento: sin esto, un permiso
// nuevo se queda en el código y su módulo es invisible en los entornos que ya
// existen — sin error, sin registro, sin nada que mirar.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncRbac } from "./rbac";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const r = await syncRbac(db);

  if (r.permisosCreados.length === 0 && r.concedidos.length === 0 && r.revocados.length === 0) {
    console.log("✅ Permisos: la base ya coincide con la matriz.");
    return;
  }

  if (r.permisosCreados.length > 0) {
    console.log(`➕ Permisos nuevos: ${r.permisosCreados.join(", ")}`);
  }
  for (const c of r.concedidos) console.log(`   + ${c.rol} → ${c.permiso}`);
  // Revocar es lo que más conviene ver: alguien deja de poder hacer algo.
  for (const c of r.revocados) console.log(`   − ${c.rol} ✗ ${c.permiso}`);
  console.log("✅ Permisos sincronizados con la matriz.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
