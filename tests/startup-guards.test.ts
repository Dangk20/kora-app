// Las guardas de arranque tienen que delatar TODO lo que falta de una vez.
//
// Lo que se fija aquí no es una comodidad de formato. Estas variables no son
// nuestras: son insumos que hay que pedirle al cliente. Cuando el contenedor
// delataba solo la primera —así estaba hasta el 27 ago 2026, cada guarda
// terminando el proceso por su cuenta— pedirlas costaba un correo, un
// despliegue de diez minutos y una espera POR CADA UNA, sobre una lista que el
// proceso ya conocía entera desde el primer arranque.
//
// Pasó de verdad al levantar producción por primera vez: el registro decía
// "Faltan estas variables: RESEND_API_KEY" y callaba las cuatro de datos del
// comerciante que también faltaban.
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fallosDeArranque } from "@/lib/startup-guards";
import { EmailDirNotWritableError, assertEmailDirWritable } from "@/modules/email/writable";

/** Un entorno de producción al que NO le falta nada. */
function produccionCompleta(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    KORA_ENV: "production",
    KORA_STORAGE_DRIVER: "disk",
    KORA_UPLOADS_DIR: "/data/uploads",
    RESEND_API_KEY: "re_prueba",
    EMAIL_FROM: "KORA <no-responder@korashopp.com>",
    KORA_LEGAL_RAZON_SOCIAL: "KORA SAS",
    KORA_LEGAL_NIT: "900000000-1",
    KORA_LEGAL_DOMICILIO: "Calle 1 #2-3, Bogotá",
    KORA_LEGAL_EMAIL: "datos@ejemplo.com",
  } as NodeJS.ProcessEnv;
}

describe("guardas de arranque — informe completo", () => {
  it("no encuentra nada que reprochar a un entorno completo", () => {
    expect(fallosDeArranque(produccionCompleta())).toEqual([]);
  });

  it("delata las TRES a la vez, no solo la primera", () => {
    const env = produccionCompleta();
    delete env.KORA_STORAGE_DRIVER;
    delete env.RESEND_API_KEY;
    delete env.KORA_LEGAL_NIT;

    const fallos = fallosDeArranque(env);

    expect(fallos).toHaveLength(3);
    expect(fallos.map((f) => f.asunto)).toEqual([
      "Imágenes de producto",
      "Envío de correo",
      "Datos del comerciante",
    ]);
  });

  it("el caso real del 27 ago: sin correo Y sin datos del comerciante, salen los dos", () => {
    // El almacenamiento sí estaba bien configurado; lo que faltaba eran los dos
    // insumos del cliente. El contenedor solo mencionaba el primero.
    const env = produccionCompleta();
    delete env.RESEND_API_KEY;
    delete env.KORA_LEGAL_RAZON_SOCIAL;
    delete env.KORA_LEGAL_NIT;
    delete env.KORA_LEGAL_DOMICILIO;
    delete env.KORA_LEGAL_EMAIL;

    const fallos = fallosDeArranque(env);

    expect(fallos).toHaveLength(2);
    expect(fallos.map((f) => f.asunto)).toContain("Envío de correo");
    expect(fallos.map((f) => f.asunto)).toContain("Datos del comerciante");
  });

  it("cada mensaje nombra las variables concretas que hay que rellenar", () => {
    // Un informe que dice "falta configuración" obliga a leer código para saber
    // qué pedir. Tiene que poder copiarse a un correo tal cual.
    const env = produccionCompleta();
    delete env.RESEND_API_KEY;
    delete env.KORA_LEGAL_NIT;
    delete env.KORA_LEGAL_EMAIL;

    const fallos = fallosDeArranque(env);
    const texto = fallos.map((f) => f.mensaje).join("\n");

    expect(texto).toContain("RESEND_API_KEY");
    expect(texto).toContain("KORA_LEGAL_NIT");
    expect(texto).toContain("KORA_LEGAL_EMAIL");
  });

  it("en desarrollo no exige nada: se trabaja sin cuenta de proveedor ni datos reales", () => {
    // Exigirlo obligaría a copiar datos de una empresa de verdad a un portátil.
    expect(fallosDeArranque({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("en pruebas no exige correo ni datos del comerciante, pero SÍ almacenamiento", () => {
    // El correo se escribe a disco en pruebas y los datos legales se muestran
    // con marcadores, así que ninguno de los dos hace falta. El almacenamiento
    // sí: pruebas también sube fotos, y si el destino no está elegido acaban en
    // la capa efímera del contenedor, que el siguiente despliegue borra. Por
    // eso `docker-compose.staging.yml` lo declara dentro del propio archivo.
    const pruebas = {
      NODE_ENV: "production",
      KORA_ENV: "staging",
      KORA_STORAGE_DRIVER: "disk",
      KORA_UPLOADS_DIR: "/data/uploads",
    } as NodeJS.ProcessEnv;

    expect(fallosDeArranque(pruebas)).toEqual([]);

    const sinAlmacenamiento = { NODE_ENV: "production", KORA_ENV: "staging" } as NodeJS.ProcessEnv;
    expect(fallosDeArranque(sinAlmacenamiento).map((f) => f.asunto)).toEqual([
      "Imágenes de producto",
    ]);
  });
});

describe("las guardas cubren LOS DOS procesos", () => {
  it("la aplicación y el worker comprueban lo mismo al arrancar", () => {
    // Garantía estructural. El 27 ago 2026, al levantar producción sin
    // proveedor de correo, la aplicación se negó a arrancar y **el worker se
    // quedó arriba tan tranquilo** — y el worker es justamente quien envía.
    // Sin proveedor no habría fallado al desplegar, cuando todavía se puede
    // revertir, sino al despachar el comprobante de un pedido real.
    //
    // Un worker sano sobre un entorno incompleto es peor que uno caído: nada
    // avisa, y sus manejadores fallan uno a uno en silencio.
    const fuente = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

    for (const archivo of ["src/instrumentation.ts", "scripts/outbox-worker.ts"]) {
      expect(
        fuente(archivo),
        `${archivo} debe comprobar la configuración al arrancar`,
      ).toContain("assertConfiguracionDeArranqueOrExit");
    }
  });

  it("🔒 pero SOLO el worker exige poder escribir los correos", () => {
    // La aplicación no envía —todo cuelga de la bandeja de salida— así que no
    // tiene montado el volumen de correos. Exigírselo la tumba por un recurso
    // que no usa: pasó el 28 ago 2026 y tiró abajo el despliegue a pruebas,
    // porque `EMAIL_DEV_DIR` sí le llega por el `env_file` compartido.
    //
    // La regla: la guarda vive donde ocurre la escritura.
    const fuente = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

    expect(fuente("scripts/outbox-worker.ts")).toContain("assertDestinoDeCorreosOrExit");
    expect(
      fuente("src/instrumentation.ts"),
      "la aplicación NO debe exigir un directorio de correos escribible",
    ).not.toContain("assertDestinoDeCorreosOrExit");
  });
});

describe("la carpeta de correos tiene que ser ESCRIBIBLE", () => {
  // El volumen `kora-staging_correos` nació de root y el worker corre como
  // `node`: entre el 7 y el 28 de agosto de 2026 CADA correo de pruebas falló
  // con EACCES y ninguno se escribió. El entorno se veía sano —worker arriba,
  // eventos consumiéndose, tienda vendiendo— y el síntoma quedaba en
  // `outbox:status`, donde hay que ir a mirarlo.
  //
  // Comprobar que un directorio EXISTE no habría servido de nada: uno de root
  // también existe. Hay que escribir en él.

  it("un directorio escribible pasa", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kora-correos-"));
    try {
      await expect(
        assertEmailDirWritable({ NODE_ENV: "development", EMAIL_DEV_DIR: dir } as NodeJS.ProcessEnv),
      ).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("🔒 uno SIN permiso de escritura tumba el arranque", async () => {
    const padre = await mkdtemp(join(tmpdir(), "kora-correos-"));
    const dir = join(padre, "prohibido");
    try {
      await chmod(padre, 0o500); // r-x: no se puede crear nada dentro
      await expect(
        assertEmailDirWritable({ NODE_ENV: "development", EMAIL_DEV_DIR: dir } as NodeJS.ProcessEnv),
      ).rejects.toThrow(EmailDirNotWritableError);
    } finally {
      await chmod(padre, 0o700).catch(() => {});
      await rm(padre, { recursive: true, force: true });
    }
  });

  it("el mensaje lleva el comando que lo arregla", async () => {
    // Se ejecuta con prisa y por alguien que no escribió esto.
    const e = new EmailDirNotWritableError("/emails", "EACCES");
    expect(e.message).toContain("chown -R 1000:1000");
    expect(e.message).toContain("outbox:status");
  });

  it("en producción no se comprueba: ahí el correo sale por el proveedor", async () => {
    const prod = {
      NODE_ENV: "production",
      KORA_ENV: "production",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "KORA <a@b.co>",
      EMAIL_DEV_DIR: "/ruta/que/no/existe/y/da/igual",
    } as NodeJS.ProcessEnv;
    await expect(assertEmailDirWritable(prod)).resolves.toBeUndefined();
  });
});
