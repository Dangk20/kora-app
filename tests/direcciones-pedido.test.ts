// Las reglas por país de una dirección y de un contacto, con la lógica real.
// Ver openspec/changes/direccion-facturacion-y-envio — specs/checkout-addresses.
import { describe, expect, it } from "vitest";
import { validarContacto, validarDireccion } from "@/modules/orders/address-rules";

describe("dirección en Colombia", () => {
  it("exige barrio y municipio del departamento, y canoniza la ciudad", () => {
    expect(validarDireccion("CO", { state: "Huila", city: "NEIVA", neighborhood: "Centro" })).toEqual({
      ok: true,
      city: "Neiva",
    });
  });

  it("sin barrio no pasa", () => {
    const r = validarDireccion("CO", { state: "Huila", city: "Neiva", neighborhood: "" });
    expect(r).toMatchObject({ ok: false, field: "neighborhood" });
  });

  it("'Medellín, Huila' es un paquete perdido", () => {
    const r = validarDireccion("CO", { state: "Huila", city: "Medellín", neighborhood: "x" });
    expect(r).toMatchObject({ ok: false, field: "city" });
  });
});

describe("dirección en Estados Unidos", () => {
  it("exige ZIP con formato y ciudad del estado", () => {
    expect(validarDireccion("US", { state: "FL", city: "Miami", zip: "33101" })).toMatchObject({ ok: true });
    expect(validarDireccion("US", { state: "FL", city: "Miami", zip: "33101-1234" })).toMatchObject({ ok: true });
  });

  it("ZIP inválido señala el ZIP", () => {
    expect(validarDireccion("US", { state: "FL", city: "Miami", zip: "3310" })).toMatchObject({ ok: false, field: "zip" });
  });

  it("no pide barrio", () => {
    expect(validarDireccion("US", { state: "FL", city: "Miami", zip: "33101", neighborhood: null })).toMatchObject({ ok: true });
  });
});

describe("contacto", () => {
  it("en Colombia el celular tiene 10 dígitos y sale en E.164", () => {
    expect(validarContacto("CO", { phone: "300 123 4567", document: "1020304050" }, { documentoObligatorio: true })).toEqual({
      ok: true,
      phone: "+573001234567",
    });
    expect(validarContacto("CO", { phone: "300 123 456", document: "1020304050" }, { documentoObligatorio: true })).toMatchObject({
      ok: false,
      field: "phone",
    });
  });

  it("el documento se exige solo cuando es obligatorio", () => {
    expect(validarContacto("CO", { phone: "3001234567", document: "" }, { documentoObligatorio: true })).toMatchObject({
      ok: false,
      field: "document",
    });
    // El destinatario: quien compra desde fuera no siempre tiene la cédula del familiar.
    expect(validarContacto("CO", { phone: "3001234567", document: "" }, { documentoObligatorio: false })).toMatchObject({
      ok: true,
    });
  });

  it("en Estados Unidos no hay documento y el teléfono lleva +1", () => {
    expect(validarContacto("US", { phone: "(305) 555-0123" }, { documentoObligatorio: true })).toEqual({
      ok: true,
      phone: "+13055550123",
    });
  });
});
