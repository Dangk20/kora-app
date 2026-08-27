// Crea (o reactiva) una cuenta de administrador real.
//
//   pnpm admin:create <correo> "<Nombre Apellido>"
//
// Existe porque hasta ahora la ÚNICA forma de tener un usuario era `db:seed`, y
// el seed trae dos cosas que en producción no pueden entrar: el administrador
// de desarrollo `admin@kora.local` con la contraseña que está escrita en la
// documentación del repositorio, y un catálogo de demostración de 21 productos.
// Sembrar producción con eso deja una puerta conocida y un catálogo falso que
// alguien tendría que borrar a mano, con el riesgo de borrar de más.
//
// La contraseña NO se pasa por argumento: los argumentos quedan en el historial
// del shell, en `ps` mientras el proceso corre y en los registros de cualquier
// envoltorio que lo invoque. Se lee de la entrada estándar, que no deja rastro:
//
//   read -rs CLAVE && printf '%s' "$CLAVE" | pnpm admin:create ana@kora.co "Ana Ruiz"
//
// En el servidor, dentro del contenedor:
//
//   printf '%s' "$CLAVE" | docker exec -i kora-prod-app node scripts/create-admin.js
//
// Tampoco se genera una contraseña automáticamente. Una contraseña que este
// guion inventa tiene que viajar hasta su dueño por algún canal, y ese canal
// —un chat, un correo, la salida de una terminal -- es justo donde no debe
// estar. La elige quien la va a usar, en su gestor de contraseñas.

import "dotenv/config";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

/** Mínimo defendible para una cuenta con acceso total al negocio. */
const LARGO_MINIMO = 12;

/** Las que ya se han usado en este proyecto y no pueden repetirse. */
const PROHIBIDAS = ["kora-dev-2026", "caja-dev-2026"];

function morir(mensaje: string): never {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

async function leerContrasena(): Promise<string> {
  // Sin TTY se lee la tubería entera; con TTY se pide por pantalla. Nunca se
  // hace eco de lo tecleado.
  if (!process.stdin.isTTY) {
    const trozos: Buffer[] = [];
    for await (const trozo of process.stdin) trozos.push(Buffer.from(trozo));
    return Buffer.concat(trozos).toString("utf8").replace(/\r?\n$/, "");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    // `terminal: true` con la salida silenciada: el cursor avanza y no se
    // imprime lo escrito.
    const salida = process.stdout.write.bind(process.stdout);
    process.stdout.write("Contraseña (no se muestra): ");
    process.stdout.write = (() => true) as typeof process.stdout.write;
    rl.question("", (respuesta) => {
      process.stdout.write = salida;
      process.stdout.write("\n");
      rl.close();
      resolve(respuesta);
    });
  });
}

async function main(): Promise<void> {
  const [correo, nombre] = process.argv.slice(2);

  if (!correo || !nombre) {
    morir('Uso: pnpm admin:create <correo> "<Nombre Apellido>"');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    morir(`'${correo}' no parece un correo.`);
  }

  const clave = await leerContrasena();

  if (clave.length < LARGO_MINIMO) {
    morir(
      `La contraseña tiene ${clave.length} caracteres y el mínimo es ${LARGO_MINIMO}. ` +
        "Esta cuenta ve y modifica el negocio entero.",
    );
  }
  if (PROHIBIDAS.includes(clave)) {
    morir(
      "Esa contraseña está escrita en la documentación del repositorio. " +
        "Cualquiera que haya visto el código la conoce.",
    );
  }

  const rolAdmin = await db.role.findUnique({ where: { name: "admin" } });
  if (!rolAdmin) {
    morir(
      "No existe el rol 'admin'. Falta aplicar la matriz de permisos: `pnpm rbac:sync` " +
        "(en el servidor lo hace el contenedor de migraciones).",
    );
  }

  const existia = await db.user.findUnique({ where: { email: correo } });

  await db.user.upsert({
    where: { email: correo },
    // Volver a ejecutarlo cambia la contraseña y reactiva la cuenta: es la vía
    // de recuperación cuando alguien pierde el acceso al panel.
    update: {
      passwordHash: await bcrypt.hash(clave, 10),
      name: nombre,
      roleId: rolAdmin.id,
      active: true,
    },
    create: {
      email: correo,
      name: nombre,
      passwordHash: await bcrypt.hash(clave, 10),
      roleId: rolAdmin.id,
    },
  });

  console.log(
    existia
      ? `✓ Contraseña actualizada y cuenta reactivada: ${correo} (admin).`
      : `✓ Administrador creado: ${correo} (admin).`,
  );

  const dev = await db.user.findUnique({ where: { email: "admin@kora.local" } });
  if (dev?.active) {
    console.warn(
      "\n⚠ Sigue activa la cuenta 'admin@kora.local', cuya contraseña está en la " +
        "documentación del repositorio. Desactívala antes de abrir la tienda.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
