import { describe, expect, it } from "vitest";
import {
  LEGAL_REQUIRED_VARS,
  LegalConfigError,
  assertLegalConfigured,
  merchant,
  missingLegalVars,
} from "@/modules/legal/config";
import { esProduccion, esStaging } from "@/lib/environment";
import { requiereProveedor } from "@/modules/email/config";

/** Entorno de producción con los cuatro datos del comerciante llenos. */
function produccionCompleta(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    KORA_LEGAL_RAZON_SOCIAL: "Comercializadora Ejemplo S.A.S.",
    KORA_LEGAL_NIT: "900.123.456-7",
    KORA_LEGAL_DOMICILIO: "Calle 1 # 2-3, Bogotá D.C., Colombia",
    KORA_LEGAL_EMAIL: "datos@ejemplo.com",
  } as NodeJS.ProcessEnv;
}

describe("datos del comerciante — guarda de arranque", () => {
  it("producción con todo configurado arranca", () => {
    expect(() => assertLegalConfigured(produccionCompleta())).not.toThrow();
    expect(missingLegalVars(produccionCompleta())).toEqual([]);
  });

  // Una por una: si la guarda solo comprobara la primera, quitar el NIT pasaría
  // desapercibido y es justo el dato que identifica al responsable.
  it.each(LEGAL_REQUIRED_VARS)("producción sin %s no arranca, y dice cuál falta", (missing) => {
    const env = produccionCompleta();
    delete env[missing];

    expect(() => assertLegalConfigured(env)).toThrow(LegalConfigError);
    expect(missingLegalVars(env)).toEqual([missing]);

    try {
      assertLegalConfigured(env);
    } catch (error) {
      // El mensaje tiene que nombrar la variable: quien lea el log del
      // despliegue fallido no debería tener que abrir el código.
      expect((error as Error).message).toContain(missing);
    }
  });

  it("una variable con solo espacios cuenta como ausente", () => {
    const env = { ...produccionCompleta(), KORA_LEGAL_NIT: "   " };

    expect(missingLegalVars(env)).toEqual(["KORA_LEGAL_NIT"]);
    expect(() => assertLegalConfigured(env)).toThrow(LegalConfigError);
  });

  it("PRUEBAS sin configurar nada arranca: no necesita el NIT real", () => {
    // La imagen se compila una vez con NODE_ENV=production y corre en los dos
    // entornos, así que la guarda tiene que mirar KORA_ENV. Si no, el entorno
    // de pruebas exigiría copiarle datos de una empresa real.
    const env = { NODE_ENV: "production", KORA_ENV: "staging" } as NodeJS.ProcessEnv;
    expect(() => assertLegalConfigured(env)).not.toThrow();
  });

  it("desarrollo sin configurar nada arranca igual", () => {
    // Exigir el NIT real rompería a cualquiera que clone el repositorio.
    expect(() => assertLegalConfigured({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).not.toThrow();
  });
});

describe("datos del comerciante — cómo se muestran", () => {
  it("en producción devuelve los datos reales y se declara completo", () => {
    const m = merchant(produccionCompleta());

    expect(m.razonSocial).toBe("Comercializadora Ejemplo S.A.S.");
    expect(m.nit).toBe("900.123.456-7");
    expect(m.incompleto).toBe(false);
  });

  it("en desarrollo devuelve marcadores imposibles de confundir con datos reales", () => {
    const m = merchant({ NODE_ENV: "development" } as NodeJS.ProcessEnv);

    expect(m.incompleto).toBe(true);
    // Entre corchetes y en mayúsculas a propósito: un marcador plausible como
    // "KORA S.A.S." se publicaría sin que nadie lo notara.
    for (const valor of [m.razonSocial, m.nit, m.domicilio, m.email]) {
      expect(valor).toMatch(/^\[.+\]$/);
    }
  });

  it("marca incompleto aunque solo falte un dato", () => {
    const env = produccionCompleta();
    delete env.KORA_LEGAL_EMAIL;

    const m = merchant(env);
    expect(m.razonSocial).toBe("Comercializadora Ejemplo S.A.S.");
    expect(m.incompleto).toBe(true);
  });
});

describe("qué entorno es este — una sola definición", () => {
  it("pruebas se declara a sí mismo", () => {
    const env = { NODE_ENV: "production", KORA_ENV: "staging" } as NodeJS.ProcessEnv;

    expect(esStaging(env)).toBe(true);
    expect(esProduccion(env)).toBe(false);
  });

  it("KORA_ENV ausente en un build de producción ES producción", () => {
    // Esta es la convención ya desplegada (deploy/README.md): solo pruebas se
    // declara, `.env.production` no lleva la variable. Invertirla haría que
    // producción se publicara con `Disallow: /` sin que nada fallara.
    const env = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

    expect(esProduccion(env)).toBe(true);
  });

  it("desarrollo no es producción", () => {
    expect(esProduccion({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("el módulo de correo y el predicado compartido no pueden discrepar", () => {
    // Si alguien reimplanta la regla en un módulo, este test lo señala: dos
    // copias equivalentes son dos sitios donde cambiar una y olvidar la otra.
    const entornos: NodeJS.ProcessEnv[] = [
      { NODE_ENV: "production" } as NodeJS.ProcessEnv,
      { NODE_ENV: "production", KORA_ENV: "staging" } as NodeJS.ProcessEnv,
      { NODE_ENV: "production", KORA_ENV: "STAGING" } as NodeJS.ProcessEnv,
      { NODE_ENV: "production", KORA_ENV: " staging " } as NodeJS.ProcessEnv,
      { NODE_ENV: "production", KORA_ENV: "production" } as NodeJS.ProcessEnv,
      { NODE_ENV: "development" } as NodeJS.ProcessEnv,
      { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    ];

    for (const env of entornos) {
      expect(requiereProveedor(env)).toBe(esProduccion(env));
    }
  });
});
