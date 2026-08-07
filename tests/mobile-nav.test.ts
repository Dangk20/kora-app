// Resolución del acceso activo de la barra inferior móvil.
//
// Parece trivial y no lo es: la ficha de producto es donde el comprador pasa
// más tiempo antes de comprar, y si ahí se apagan los cuatro accesos, la
// tienda comunica "estás fuera" justo en ese momento.
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/modules/storefront/mobile/nav-items";

/** Qué acceso queda marcado para una ruta dada. */
function activo(path: string): string | null {
  return NAV_ITEMS.find((i) => i.match(path))?.label ?? null;
}

describe("barra inferior móvil", () => {
  it("tiene exactamente los cuatro accesos del diseño", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(["Inicio", "Catálogo", "Carrito", "Cuenta"]);
  });

  it.each([
    ["/", "Inicio"],
    ["/catalogo", "Catálogo"],
    ["/catalogo?categoria=tecnologia", "Catálogo"],
    ["/carrito", "Carrito"],
    ["/cuenta", "Cuenta"],
    ["/cuenta/pedidos", "Cuenta"],
    ["/cuenta/entrar", "Cuenta"],
  ])("%s marca '%s'", (ruta, esperado) => {
    expect(activo(ruta)).toBe(esperado);
  });

  it("la ficha de producto marca 'Catálogo', no deja los cuatro apagados", () => {
    expect(activo("/producto/audifonos-kora")).toBe("Catálogo");
  });

  it("solo un acceso puede estar activo a la vez", () => {
    for (const ruta of ["/", "/catalogo", "/producto/x", "/carrito", "/cuenta", "/cuenta/pedidos"]) {
      expect(NAV_ITEMS.filter((i) => i.match(ruta))).toHaveLength(1);
    }
  });

  it("una ruta ajena no enciende ninguno", () => {
    // El checkout tiene su propio camino y no es una sección de la barra.
    expect(activo("/legal/terminos")).toBeNull();
  });

  it("'Inicio' NO se enciende en cualquier ruta", () => {
    // Un `startsWith("/")` lo encendería en todas y sería un error invisible.
    expect(NAV_ITEMS[0].match("/catalogo")).toBe(false);
  });
});
