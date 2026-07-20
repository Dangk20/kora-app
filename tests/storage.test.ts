// Almacenamiento de imágenes. Lo crítico:
//   1. Una key maliciosa no puede escribir ni leer fuera de .uploads.
//   2. El tipo real de la imagen manda sobre lo que declare el navegador.
//   3. En producción, sin R2 configurado, la app falla en vez de servir
//      imágenes desde el VPS.
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  imageKey,
  resetStorage,
  resolveUploadPath,
  sniffImageType,
  storage,
  UPLOADS_DIR,
} from "@/modules/storage";
import { LocalStorageDriver } from "@/modules/storage/local-driver";

// Bytes mínimos con los magic numbers reales de cada formato.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.alloc(4),
  Buffer.from("WEBP", "ascii"),
]);
const AVIF = Buffer.concat([
  Buffer.alloc(4),
  Buffer.from("ftyp", "ascii"),
  Buffer.from("avif", "ascii"),
]);

afterAll(async () => {
  await rm(path.join(UPLOADS_DIR, "productos", "test-storage"), {
    recursive: true,
    force: true,
  });
});

describe("keys de almacenamiento", () => {
  it("genera una key única por subida, con la extensión del tipo real", () => {
    const a = imageKey("prod-1", "image/png");
    const b = imageKey("prod-1", "image/png");
    expect(a).toMatch(/^productos\/prod-1\/[0-9a-f-]{36}\.png$/);
    expect(a).not.toBe(b); // nunca reutiliza nombre: el CDN puede cachear para siempre
    expect(imageKey("prod-1", "image/jpeg")).toMatch(/\.jpg$/);
  });

  it("rechaza tipos que no son imagen permitida", () => {
    expect(() => imageKey("prod-1", "image/gif")).toThrow();
    expect(() => imageKey("prod-1", "application/pdf")).toThrow();
  });

  it("no deja escapar de la carpeta de subidas", () => {
    expect(resolveUploadPath("../../etc/passwd")).toBeNull();
    expect(resolveUploadPath("/etc/passwd")).toBeNull();
    expect(resolveUploadPath("productos/x/../../../secreto.txt")).toBeNull();
    expect(resolveUploadPath("productos/ok/imagen.png")).toContain(".uploads");
  });
});

describe("detección del tipo real", () => {
  it("reconoce los formatos permitidos por sus magic numbers", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(AVIF)).toBe("image/avif");
  });

  it("no se deja engañar por un archivo que dice ser imagen", () => {
    // Un .exe o un script renombrado a .png: el content-type miente, los bytes no.
    expect(sniffImageType(Buffer.from("MZ\x90\x00 ejecutable de Windows"))).toBeNull();
    expect(sniffImageType(Buffer.from("<?php system($_GET[0]); ?>"))).toBeNull();
    expect(sniffImageType(Buffer.from("corto"))).toBeNull();
  });
});

describe("driver de disco (desarrollo)", () => {
  it("guarda, sirve por /media y borra", async () => {
    const driver = new LocalStorageDriver();
    const key = "productos/test-storage/imagen.png";

    const stored = await driver.put(key, PNG);
    expect(stored.url).toBe("/media/productos/test-storage/imagen.png");
    expect(await readFile(path.join(UPLOADS_DIR, key))).toEqual(PNG);

    await driver.delete(key);
    await expect(readFile(path.join(UPLOADS_DIR, key))).rejects.toThrow();
  });

  it("borrar algo que no existe no es un error", async () => {
    await expect(
      new LocalStorageDriver().delete("productos/test-storage/fantasma.png"),
    ).resolves.toBeUndefined();
  });

  it("una key que se escapa no escribe nada", async () => {
    await expect(
      new LocalStorageDriver().put("../fuera.png", PNG),
    ).rejects.toThrow("Key inválida");
  });
});

describe("selección de driver por entorno", () => {
  it("en desarrollo, sin R2 configurado, usa el disco local", () => {
    resetStorage();
    expect(storage().name).toBe("local");
  });

  it("en producción, sin R2 configurado, falla en vez de servir desde el VPS", () => {
    resetStorage();
    const previous = process.env.NODE_ENV;
    try {
      // NODE_ENV es readonly en los tipos de Node; el test necesita simularlo.
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(() => storage()).toThrow(/Falta configurar R2/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = previous ?? "test";
      resetStorage();
    }
  });

  it("con R2 configurado usa R2 y arma la URL pública del CDN", () => {
    resetStorage();
    const vars = {
      R2_ACCOUNT_ID: "cuenta",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secreto",
      R2_BUCKET: "kora",
      R2_PUBLIC_URL: "https://cdn.kora.com/", // con barra final a propósito
    };
    Object.assign(process.env, vars);
    try {
      const driver = storage();
      expect(driver.name).toBe("r2");
      expect(driver.urlFor("productos/1/a.png")).toBe(
        "https://cdn.kora.com/productos/1/a.png",
      );
    } finally {
      for (const k of Object.keys(vars)) delete process.env[k];
      resetStorage();
    }
  });
});
