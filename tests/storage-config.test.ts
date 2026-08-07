// Elección del almacenamiento y persistencia de las imágenes.
//
// Lo que se fija aquí no produce ningún error cuando se rompe, y esa es la
// razón de que existan estas pruebas: un almacenamiento mal elegido guarda las
// fotos en un sitio que el siguiente despliegue borra, y la tienda sigue
// respondiendo 200 con el catálogo entero sin imágenes.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  StorageConfigError,
  assertStorageConfigured,
  configuredDriver,
  uploadsDir,
} from "@/modules/storage/config";
import {
  StoragePersistenceError,
  assertStoragePersists,
} from "@/modules/storage/persistence";
import { resolveUploadPath } from "@/modules/storage/local-driver";

const R2_COMPLETO = {
  R2_ACCOUNT_ID: "cuenta",
  R2_ACCESS_KEY_ID: "clave",
  R2_SECRET_ACCESS_KEY: "secreto",
  R2_BUCKET: "bucket",
  R2_PUBLIC_URL: "https://cdn.ejemplo.com",
};

const temporales: string[] = [];

function dirTemporal(): string {
  const d = mkdtempSync(join(tmpdir(), "kora-uploads-"));
  temporales.push(d);
  return d;
}

afterEach(() => {
  while (temporales.length) rmSync(temporales.pop()!, { recursive: true, force: true });
});

describe("elección del destino de las imágenes", () => {
  it("desarrollo sin configurar nada usa disco", () => {
    const env = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

    expect(configuredDriver(env)).toBe("disk");
    expect(() => assertStorageConfigured(env)).not.toThrow();
  });

  it("producción sin elegir NO arranca", () => {
    // Sin valor por defecto a propósito: elegir en silencio por el operador
    // sería elegir mal sin avisar.
    const env = { NODE_ENV: "production", ...R2_COMPLETO } as NodeJS.ProcessEnv;

    expect(configuredDriver(env)).toBeNull();
    expect(() => assertStorageConfigured(env)).toThrow(StorageConfigError);
    expect(() => assertStorageConfigured(env)).toThrow(/KORA_STORAGE_DRIVER/);
  });

  it("un valor no reconocido falla nombrando los válidos", () => {
    const env = { NODE_ENV: "production", KORA_STORAGE_DRIVER: "s3" } as NodeJS.ProcessEnv;

    expect(() => configuredDriver(env)).toThrow(/no es válido/);
    expect(() => configuredDriver(env)).toThrow(/disk, r2/);
  });

  it("r2 con credenciales completas arranca", () => {
    const env = {
      NODE_ENV: "production",
      KORA_STORAGE_DRIVER: "r2",
      ...R2_COMPLETO,
    } as NodeJS.ProcessEnv;

    expect(() => assertStorageConfigured(env)).not.toThrow();
  });

  it.each(Object.keys(R2_COMPLETO))("r2 sin %s NO cae a disco: falla", (falta) => {
    // Este es el defecto que el cambio corrige. Antes, un error de tecleo en
    // una credencial de R2 no daba error: se guardaban las fotos en el sistema
    // de archivos del contenedor y el siguiente despliegue las borraba.
    const env = {
      NODE_ENV: "production",
      KORA_STORAGE_DRIVER: "r2",
      ...R2_COMPLETO,
    } as NodeJS.ProcessEnv;
    delete env[falta];

    expect(() => assertStorageConfigured(env)).toThrow(StorageConfigError);
    expect(() => assertStorageConfigured(env)).toThrow(new RegExp(falta));
    // Y el mensaje tiene que decir POR QUÉ no cae a disco, o el siguiente que
    // lo lea "arreglará" el error quitando la variable.
    expect(() => assertStorageConfigured(env)).toThrow(/NO se cae a disco/);
  });

  it("disk sin directorio configurado falla en producción", () => {
    const env = { NODE_ENV: "production", KORA_STORAGE_DRIVER: "disk" } as NodeJS.ProcessEnv;

    expect(() => assertStorageConfigured(env)).toThrow(/KORA_UPLOADS_DIR/);
    // El mensaje explica que la ruta tiene que coincidir con el volumen.
    expect(() => assertStorageConfigured(env)).toThrow(/volumen/);
  });

  it("disk con directorio configurado arranca", () => {
    const env = {
      NODE_ENV: "production",
      KORA_STORAGE_DRIVER: "disk",
      KORA_UPLOADS_DIR: "/data/uploads",
    } as NodeJS.ProcessEnv;

    expect(() => assertStorageConfigured(env)).not.toThrow();
    expect(uploadsDir(env)).toBe("/data/uploads");
  });

  it("elegir disk ignora credenciales de R2 presentes", () => {
    // Si alguien deja las variables viejas puestas, manda la elección explícita.
    const env = {
      NODE_ENV: "production",
      KORA_STORAGE_DRIVER: "disk",
      KORA_UPLOADS_DIR: "/data/uploads",
      ...R2_COMPLETO,
    } as NodeJS.ProcessEnv;

    expect(configuredDriver(env)).toBe("disk");
    expect(() => assertStorageConfigured(env)).not.toThrow();
  });
});

describe("persistencia del almacenamiento", () => {
  const prodDisk = (dir: string) =>
    ({
      NODE_ENV: "production",
      KORA_STORAGE_DRIVER: "disk",
      KORA_UPLOADS_DIR: dir,
    }) as NodeJS.ProcessEnv;

  it("base con imágenes y directorio vacío: NO arranca", async () => {
    // El caso que destruye el trabajo del cliente: volumen olvidado, el
    // despliegue se llevó las fotos, y la tienda respondería 200 sin ninguna.
    const dir = dirTemporal();

    await expect(assertStoragePersists(async () => 340, prodDisk(dir))).rejects.toThrow(
      StoragePersistenceError,
    );
    await expect(assertStoragePersists(async () => 340, prodDisk(dir))).rejects.toThrow(
      /no está persistiendo/i,
    );
  });

  it("el error dice cuántas imágenes faltan y dónde debían estar", async () => {
    const dir = dirTemporal();

    try {
      await assertStoragePersists(async () => 340, prodDisk(dir));
      expect.unreachable("debería haber lanzado");
    } catch (error) {
      expect((error as Error).message).toContain("340");
      expect((error as Error).message).toContain(dir);
      expect((error as Error).message).toMatch(/volumen/);
    }
  });

  it("instalación nueva: base vacía y directorio vacío arranca", async () => {
    const dir = dirTemporal();

    await expect(assertStoragePersists(async () => 0, prodDisk(dir))).resolves.toBeUndefined();
  });

  it("con imágenes en disco arranca", async () => {
    const dir = dirTemporal();
    mkdirSync(join(dir, "productos", "abc"), { recursive: true });
    writeFileSync(join(dir, "productos", "abc", "foto.jpg"), "bytes");

    await expect(assertStoragePersists(async () => 340, prodDisk(dir))).resolves.toBeUndefined();
  });

  it("encuentra archivos en subdirectorios, no solo en la raíz", async () => {
    // Las claves son `productos/<id>/<uuid>.jpg`: mirar solo la raíz daría
    // siempre "vacío" y tumbaría el arranque de una instalación sana.
    const dir = dirTemporal();
    mkdirSync(join(dir, "productos", "x", "y"), { recursive: true });
    writeFileSync(join(dir, "productos", "x", "y", "foto.png"), "bytes");

    await expect(assertStoragePersists(async () => 1, prodDisk(dir))).resolves.toBeUndefined();
  });

  it("un directorio que ni existe cuenta como vacío", async () => {
    const env = prodDisk(join(dirTemporal(), "no-existe"));

    await expect(assertStoragePersists(async () => 5, env)).rejects.toThrow(
      StoragePersistenceError,
    );
  });

  it("con almacenamiento remoto no comprueba nada local", async () => {
    const env = {
      NODE_ENV: "production",
      KORA_STORAGE_DRIVER: "r2",
      KORA_UPLOADS_DIR: join(dirTemporal(), "no-existe"),
    } as NodeJS.ProcessEnv;

    await expect(assertStoragePersists(async () => 340, env)).resolves.toBeUndefined();
  });

  it("en desarrollo no comprueba nada", async () => {
    const env = {
      NODE_ENV: "development",
      KORA_UPLOADS_DIR: join(dirTemporal(), "no-existe"),
    } as NodeJS.ProcessEnv;

    await expect(assertStoragePersists(async () => 340, env)).resolves.toBeUndefined();
  });
});

describe("las claves no pueden salirse del directorio", () => {
  it("acepta una clave normal", () => {
    const raiz = "/data/uploads";
    expect(resolveUploadPath("productos/abc/foto.jpg", raiz)).toBe(
      "/data/uploads/productos/abc/foto.jpg",
    );
  });

  it.each([
    "../../../etc/passwd",
    "productos/../../../etc/passwd",
    "/etc/passwd",
    "",
  ])("rechaza '%s'", (key) => {
    expect(resolveUploadPath(key, "/data/uploads")).toBeNull();
  });

  it("rechaza una clave con byte nulo", () => {
    expect(resolveUploadPath("productos/foto.jpg\0.txt", "/data/uploads")).toBeNull();
  });
});
