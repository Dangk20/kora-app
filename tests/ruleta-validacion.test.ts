// Datos del registro rápido de la ruleta: solo celulares y correos válidos.
import { describe, expect, it } from "vitest";
import { celularColombiano, correoValido, sugerenciaCorreo } from "@/modules/ruleta/validacion";

describe("celular", () => {
  it("acepta 10 dígitos que empiezan por 3, con o sin +57 y espacios", () => {
    expect(celularColombiano("3001234567")).toBe("3001234567");
    expect(celularColombiano("300 123 4567")).toBe("3001234567");
    expect(celularColombiano("+57 300 123 4567")).toBe("3001234567");
  });
  it("rechaza lo que no es un celular colombiano", () => {
    for (const x of ["", "300123456", "30012345678", "6001234567", "1234567890", "abcdefghij", "0000000000"]) {
      expect(celularColombiano(x), x).toBeNull();
    }
  });
});

describe("correo", () => {
  it("acepta correos reales y los deja en minúscula", () => {
    expect(correoValido("DANSAGO33@GMAIL.COM")).toBe("dansago33@gmail.com");
    expect(correoValido("ana.maria+kora@empresa.com.co")).toBe("ana.maria+kora@empresa.com.co");
  });
  it("rechaza datos de relleno", () => {
    for (const x of ["", "a", "asd@", "@gmail.com", "pepe@gmail", "pepe@gmail.c", "pepe gmail.com", "pe pe@gmail.com", "pepe@@gmail.com", "pepe..x@gmail.com", "pepe@.com"]) {
      expect(correoValido(x), x).toBeNull();
    }
  });
  it("sugiere el dominio cuando hay un error de digitación", () => {
    expect(sugerenciaCorreo("pepe@gmial.com")).toBe("pepe@gmail.com");
    expect(sugerenciaCorreo("pepe@hotmail.con")).toBe("pepe@hotmail.com");
    expect(sugerenciaCorreo("dansago44@gmil.com")).toBe("dansago44@gmail.com");
    expect(sugerenciaCorreo("pepe@gmail.co")).toBe("pepe@gmail.com");
    expect(sugerenciaCorreo("pepe@hotmial.com")).toBe("pepe@hotmail.com");
    expect(sugerenciaCorreo("pepe@outlok.es")).toBe("pepe@outlook.es");
    expect(sugerenciaCorreo("pepe@yaho.com")).toBe("pepe@yahoo.com");
    expect(sugerenciaCorreo("pepe@iclod.com")).toBe("pepe@icloud.com");
    // Correctos y dominios reales parecidos: sin sugerencia.
    for (const ok of ["pepe@gmail.com", "pepe@mail.com", "pepe@live.com", "pepe@ymail.com", "pepe@empresa.com.co", "pepe@unal.edu.co"]) {
      expect(sugerenciaCorreo(ok), ok).toBeNull();
    }
  });
});
