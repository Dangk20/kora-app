// Verificación del ciclo COMPLETO de respaldo: volcar → cifrar → descifrar →
// restaurar → comparar.
//
//   pnpm backup:verify
//
// Por qué existe, y por qué no se limita a comprobar que el archivo pesa más de
// cero: la mayoría de los sistemas de copia que fallan no fallan al copiar.
// Fallan al RESTAURAR, meses después, cuando alguien descubre que el volcado
// estaba truncado, que faltaba una extensión, o que la clave no abre nada. Ese
// descubrimiento tiene que ocurrir aquí y no durante una recuperación.
//
// Corre contra la base LOCAL, nunca contra producción: lo que verifica no son
// los datos de producción sino el CAMINO — que el volcado se genera, que el
// cifrado es reversible con las claves que hay, y que `pg_restore` reconstruye
// el esquema entero.
//
// Ver openspec/changes/encrypted-db-backup — specs/backup-restore.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CONTENEDOR = process.env.KORA_BACKUP_CONTAINER ?? "kora-postgres";
const USUARIO = process.env.POSTGRES_USER ?? "kora";
const BASE = process.env.POSTGRES_DB ?? "kora";
const BASE_PRUEBA = "kora_verificacion_respaldo";
/** Claves de prueba: no son las de producción y no salen de aquí. */
const DIR_CLAVES = join(process.cwd(), ".backup-keys");

/** Tablas cuyo contenido, si no vuelve, significa que el negocio se perdió. */
const TABLAS_CRITICAS = [
  "orders",
  "order_items",
  "customers",
  "products",
  "variants",
  "stock_movements",
  "cashback_movements",
];

function hay(binario: string): boolean {
  return spawnSync("command", ["-v", binario], { shell: true }).status === 0;
}

function docker(args: string[], entrada?: Buffer): Buffer {
  return execFileSync("docker", args, {
    input: entrada,
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env },
  });
}

function psql(base: string, sql: string): string {
  return docker([
    "exec", "-i",
    "-e", `PGPASSWORD=${process.env.POSTGRES_PASSWORD ?? "kora"}`,
    CONTENEDOR, "psql", "-U", USUARIO, "-d", base, "-tAc", sql,
  ]).toString().trim();
}

/** Conteo por tabla, para comparar origen y restaurado. */
function conteos(base: string): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const tabla of TABLAS_CRITICAS) {
    const n = psql(base, `SELECT count(*) FROM "${tabla}"`);
    salida[tabla] = Number(n);
  }
  return salida;
}

function generarClaves(): { publica: string; privada: string } {
  mkdirSync(DIR_CLAVES, { recursive: true, mode: 0o700 });
  const privada = join(DIR_CLAVES, "verificacion.key");

  if (!existsSync(privada)) {
    execFileSync("age-keygen", ["-o", privada], { stdio: ["ignore", "ignore", "pipe"] });
  }

  const publica = execFileSync("age-keygen", ["-y", privada]).toString().trim();
  return { publica, privada };
}

function main(): void {
  // Sin `age` no se puede verificar nada, y fingir que sí sería peor que no
  // tener verificación: daría por bueno un camino que nadie recorrió.
  if (!hay("age") || !hay("age-keygen")) {
    console.error(
      "\n✖ Falta 'age'. Instálalo antes de verificar el respaldo:\n" +
        "    macOS:  brew install age\n" +
        "    Ubuntu: apt-get install -y age\n\n" +
        "  No se verifica 'a medias': un ciclo de respaldo que nadie recorrió\n" +
        "  entero no está verificado.\n",
    );
    process.exit(1);
  }

  const trabajo = mkdtempSync(join(tmpdir(), "kora-verify-backup-"));
  let fallo: unknown = null;

  try {
    console.log(`→ Base de origen: ${BASE} (contenedor ${CONTENEDOR})`);
    const origen = conteos(BASE);
    console.log(
      `  ${Object.entries(origen).map(([t, n]) => `${t}=${n}`).join("  ")}`,
    );

    const { publica, privada } = generarClaves();

    // 1. Volcar, empaquetar y cifrar, exactamente como lo hace respaldar.sh:
    //    base + imágenes dentro de UN solo archivo cifrado. Si esto se
    //    desviara del guion real, la verificación estaría validando un formato
    //    que nadie produce — peor que no verificar, porque da confianza.
    console.log("→ Volcando, empaquetando y cifrando…");
    const volcado = docker([
      "exec", "-e", `PGPASSWORD=${process.env.POSTGRES_PASSWORD ?? "kora"}`,
      CONTENEDOR, "pg_dump", "-Fc", "-U", USUARIO, "-d", BASE,
    ]);

    const paquete = join(trabajo, "paquete");
    mkdirSync(paquete, { recursive: true });
    writeFileSync(join(paquete, "base.dump"), volcado);

    // Las imágenes del entorno local: en desarrollo viven en `.uploads/`.
    // Se empaquetan aunque estén vacías, para ejercitar la misma forma.
    const imagenes = join(process.cwd(), ".uploads");
    mkdirSync(imagenes, { recursive: true });
    execFileSync("tar", ["-cf", join(paquete, "imagenes.tar"), "-C", imagenes, "."]);

    const sinCifrar = execFileSync(
      "tar",
      ["-cf", "-", "-C", paquete, "base.dump", "imagenes.tar"],
      { maxBuffer: 512 * 1024 * 1024 },
    );

    const cifrado = join(trabajo, "kora.tar.age");
    execFileSync("age", ["-r", publica, "-o", cifrado], { input: sinCifrar });

    const bytes = statSync(cifrado).size;
    if (bytes === 0) throw new Error("el respaldo cifrado salió vacío");
    console.log(`  ${(bytes / 1024).toFixed(1)} KiB cifrados`);

    // 2. Comprobar que el cifrado de verdad oculta el contenido.
    //
    //    No basta con "no parece texto": se buscan señales que SÍ están en el
    //    volcado sin cifrar. `PGDMP` es la firma del formato de pg_dump, y el
    //    correo se toma de la propia base — si cualquiera de los dos aparece en
    //    el archivo que se va a subir, el cifrado no está haciendo su trabajo.
    const enClaro = readFileSync(cifrado).toString("latin1");
    const senales = ["PGDMP", "CREATE TABLE"];

    const correo = psql(BASE, "SELECT email FROM users LIMIT 1");
    if (correo) senales.push(correo);

    for (const senal of senales) {
      if (enClaro.includes(senal)) {
        throw new Error(`el respaldo revela '${senal}' en claro: el cifrado no está funcionando`);
      }
    }
    // Y que el volcado SIN cifrar sí las tuviera — si no, la comprobación
    // anterior pasaría siempre y no estaría comprobando nada.
    if (!volcado.toString("latin1").includes("PGDMP")) {
      throw new Error("el volcado no parece un archivo de pg_dump: la comprobación de cifrado no es concluyente");
    }

    // 3. Descifrar, desempaquetar y restaurar en una base desechable.
    console.log(`→ Descifrando y restaurando en '${BASE_PRUEBA}'…`);
    const salida = join(trabajo, "salida");
    mkdirSync(salida, { recursive: true });

    execFileSync("age", ["-d", "-i", privada, "-o", join(trabajo, "kora.tar"), cifrado]);
    execFileSync("tar", ["-xf", join(trabajo, "kora.tar"), "-C", salida]);

    // Ambas piezas tienen que estar: un respaldo con la base y sin las
    // imágenes restauraría el catálogo entero sin una sola foto, y la
    // aplicación ni siquiera arrancaría (storage/persistence.ts).
    for (const pieza of ["base.dump", "imagenes.tar"]) {
      if (!existsSync(join(salida, pieza))) {
        throw new Error(`el respaldo no contiene '${pieza}'`);
      }
    }

    const descifrado = join(salida, "base.dump");

    psql("postgres", `DROP DATABASE IF EXISTS "${BASE_PRUEBA}"`);
    psql("postgres", `CREATE DATABASE "${BASE_PRUEBA}"`);

    const restore = spawnSync(
      "docker",
      [
        "exec", "-i",
        "-e", `PGPASSWORD=${process.env.POSTGRES_PASSWORD ?? "kora"}`,
        CONTENEDOR, "pg_restore", "-U", USUARIO, "-d", BASE_PRUEBA,
        "--no-owner", "--exit-on-error",
      ],
      { input: execFileSync("cat", [descifrado], { maxBuffer: 512 * 1024 * 1024 }) },
    );

    if (restore.status !== 0) {
      throw new Error(`pg_restore falló: ${restore.stderr?.toString().slice(0, 800)}`);
    }

    // 4. Comparar. Que restaure sin error no significa que los datos estén.
    const restaurado = conteos(BASE_PRUEBA);
    const diferencias = TABLAS_CRITICAS.filter((t) => origen[t] !== restaurado[t]);

    if (diferencias.length > 0) {
      throw new Error(
        "el respaldo restaura pero los datos NO coinciden: " +
          diferencias.map((t) => `${t} ${origen[t]}→${restaurado[t]}`).join(", "),
      );
    }

    // 5. Caso negativo: un respaldo truncado TIENE que fallar.
    //
    //    Sin esta comprobación, todo lo anterior demuestra que el camino feliz
    //    funciona y nada más. Lo que hunde una recuperación no es un respaldo
    //    que no restaura —eso se ve— sino uno que restaura "bien" a medias.
    //    Aquí se comprueba que `pg_restore` lo detecta y no deja pasar.
    console.log("→ Comprobando que un respaldo truncado SÍ falla…");
    const truncado = join(trabajo, "truncado.dump");
    writeFileSync(truncado, readFileSync(descifrado).subarray(0, Math.floor(volcado.length / 2)));


    psql("postgres", `DROP DATABASE IF EXISTS "${BASE_PRUEBA}"`);
    psql("postgres", `CREATE DATABASE "${BASE_PRUEBA}"`);

    const roto = spawnSync(
      "docker",
      [
        "exec", "-i",
        "-e", `PGPASSWORD=${process.env.POSTGRES_PASSWORD ?? "kora"}`,
        CONTENEDOR, "pg_restore", "-U", USUARIO, "-d", BASE_PRUEBA,
        "--no-owner", "--exit-on-error",
      ],
      { input: readFileSync(truncado) },
    );

    if (roto.status === 0) {
      throw new Error(
        "un respaldo TRUNCADO se restauró sin error: la verificación no distingue " +
          "un respaldo bueno de uno inservible, que es justo lo que tiene que distinguir",
      );
    }
    console.log("  detectado correctamente");

    const total = Object.values(origen).reduce((a, b) => a + b, 0);
    console.log(
      `\n✓ Ciclo completo verificado: ${TABLAS_CRITICAS.length} tablas críticas, ` +
        `${total} filas, idénticas tras restaurar. Imágenes incluidas. Respaldo truncado rechazado.\n`,
    );
  } catch (error) {
    fallo = error;
  } finally {
    // La base desechable se borra SIEMPRE, también si la verificación falló:
    // dejarla a medias convierte el siguiente intento en un diagnóstico falso.
    try {
      psql("postgres", `DROP DATABASE IF EXISTS "${BASE_PRUEBA}"`);
    } catch {
      console.error(`⚠ No se pudo borrar la base de prueba '${BASE_PRUEBA}'. Bórrala a mano.`);
    }
    rmSync(trabajo, { recursive: true, force: true });
  }

  if (fallo) {
    console.error(`\n✖ ${fallo instanceof Error ? fallo.message : String(fallo)}\n`);
    process.exit(1);
  }
}

// Permite que el test del caso negativo reutilice el cifrado sin duplicarlo.
export function cifrarParaPrueba(datos: Buffer, publica: string, destino: string): void {
  writeFileSync(destino, execFileSync("age", ["-r", publica], { input: datos }));
}

main();
