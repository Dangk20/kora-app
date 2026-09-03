// Retirar un producto del catálogo.
// Ver `archiveProduct` en src/modules/catalog/product-actions.ts.
//
// Lo que se defiende: que "eliminar" NO destruya el libro de inventario ni el
// historial de ventas. `StockMovement.variant` y `OrderItem.variant` son
// Restrict —la base ya lo impide— pero la regla tiene que estar también en el
// código, porque el día que alguien añada `onDelete: Cascade` "para que
// funcione", la base dejaría de defenderla.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const accion = readFileSync("src/modules/catalog/product-actions.ts", "utf8");
const esquema = readFileSync("prisma/schema.prisma", "utf8");

describe("un producto con historia se archiva, no se borra", () => {
  it("solo se borra cuando no hay ventas NI movimientos de inventario", () => {
    expect(accion).toContain("const sinHistoria = ventas === 0 && movimientos === 0");
    expect(accion).toMatch(/if \(sinHistoria\) \{\s*await tx\.product\.delete/);
  });

  it("archivar desactiva el producto y sus variantes, sin borrar nada", () => {
    // Acotado al bloque de archivar: sin el límite, el trozo llegaba hasta
    // `restoreProduct` y encontraba el "delete" de su permiso.
    const bloque = accion.slice(
      accion.indexOf("// Archivar:"),
      accion.indexOf("revalidatePath", accion.indexOf("// Archivar:")),
    );
    expect(bloque).toContain("tx.variant.updateMany");
    expect(bloque).toContain("active: false, featured: false");
    expect(bloque).not.toContain("delete");
  });

  it("la base sigue impidiendo borrar lo que tiene libro", () => {
    // Si alguien pone `onDelete: Cascade` aquí, borrar un producto se llevaría
    // por delante su libro de inventario y las líneas de pedidos que lo
    // vendieron. La prueba existe para que ese cambio no pase inadvertido.
    const movimiento = esquema.slice(esquema.indexOf("model StockMovement"));
    const linea = movimiento.split("\n").find((l) => l.includes("variant   Variant"));
    expect(linea).not.toContain("onDelete");

    const item = esquema.slice(esquema.indexOf("model OrderItem"));
    const lineaItem = item.split("\n").find((l) => l.includes("variant   Variant"));
    expect(lineaItem).not.toContain("onDelete");
  });
});

describe("el registro de la decisión", () => {
  it("exige un motivo con contenido", () => {
    expect(accion).toContain("motivo.length < 10");
  });

  it("se escribe ANTES de tocar el producto", () => {
    // Si el borrado falla, queda constancia del intento en vez de un producto
    // a medio retirar.
    const i = accion.indexOf("tx.productArchive.create");
    const j = accion.indexOf("tx.product.delete");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(j);
  });

  it("guarda cuánto tenía: sin eso, «se retiró con stock» no se puede comprobar", () => {
    expect(accion).toContain("hadStock: stock");
    expect(accion).toContain("hadOrders: ventas");
  });

  it("el nombre sobrevive al borrado del producto", () => {
    const modelo = esquema.slice(esquema.indexOf("model ProductArchive"));
    expect(modelo).toContain("productName String");
    expect(modelo).toContain("onDelete: SetNull");
  });
});

describe("el alta por pasos no se guarda a medias", () => {
  // EL FALLO (2 sep 2026, lo encontró Daniel creando "Camiseta Polo"): en un
  // `<form action={…}>`, pulsar Enter en cualquier campo ENVÍA. En un recorrido
  // de tres pasos eso guardaba el producto desde el paso 1 o el 2 —a medio
  // llenar y sin stock— y el modal se cerraba solo. Desde fuera parecía que se
  // cerraba SIN guardar; en realidad guardaba mal, y quedaba un producto con
  // sus nueve variantes y cero unidades.
  const formulario = readFileSync("src/app/admin/catalogo/product-form.tsx", "utf8");

  it("Enter no envía el formulario en el recorrido", () => {
    expect(formulario).toContain('if (e.key !== "Enter" || !porPasos) return;');
    expect(formulario).toContain("e.preventDefault();");
  });

  it("Enter avanza de paso en un alta, en vez de guardar", () => {
    expect(formulario).toMatch(/if \(esAlta && paso < 2\) \{\s*setPaso\(paso \+ 1\)/);
  });

  it("en un área de texto, Enter sigue siendo un salto de línea", () => {
    expect(formulario).toContain('if (destino.tagName === "TEXTAREA") return;');
  });

  it("la comprobación de campos vive fuera del botón, porque hay DOS caminos", () => {
    // Con la comprobación solo en el onClick del botón, la tecla Enter se la
    // saltaba entera.
    expect(formulario).toContain("const puedeEnviar = (form: HTMLFormElement): boolean =>");
    expect(formulario).toContain("if (puedeEnviar(form)) form.requestSubmit();");
  });
});

describe("archivado no es lo mismo que inactivo", () => {
  // EL FALLO (2 sep 2026, lo encontró Daniel): archivar ponía `active = false`,
  // que es EXACTAMENTE el estado del interruptor Inactivo. El producto
  // retirado se quedaba en el listado, indistinguible de uno que el operador
  // apagó porque se agotó — y como seguía ahí con su botón, se podía retirar
  // una y otra vez: el historial acabó con tres entradas idénticas del mismo
  // producto, y un registro de auditoría que se repite deja de creerse.
  const esquema2 = readFileSync("prisma/schema.prisma", "utf8");
  const pagina = readFileSync("src/app/admin/catalogo/page.tsx", "utf8");

  it("el archivado tiene su propio campo", () => {
    const producto = esquema2.slice(
      esquema2.indexOf("model Product {"),
      esquema2.indexOf("model Variant {"),
    );
    expect(producto).toMatch(/archivedAt\s+DateTime\?/);
  });

  it("archivar lo marca, además de desactivarlo", () => {
    expect(accion).toContain("archivedAt: new Date()");
  });

  it("el listado del panel excluye los retirados", () => {
    expect(pagina).toContain("{ archivedAt: null }");
  });

  it("un producto ya retirado no se puede retirar otra vez", () => {
    expect(accion).toContain("if (producto.archivedAt) {");
  });
});

describe("volver atrás de un archivado", () => {
  it("existe restaurar: sin ello, archivar por error no tiene salida", () => {
    // La única alternativa sería volver a crear el producto, perdiendo el
    // historial de inventario y ventas que archivar existe para conservar.
    expect(accion).toContain("export async function restoreProduct(");
  });

  it("vuelve INACTIVO, no activo", () => {
    // Quien lo retiró tenía un motivo; republicarlo en la tienda es una
    // decisión aparte, del interruptor.
    const bloque = accion.slice(accion.indexOf("export async function restoreProduct("));
    expect(bloque).toContain("data: { archivedAt: null }");
    expect(bloque).not.toContain("active: true");
  });
});

describe("un producto con pedidos sin entregar no se retira", () => {
  // Regla de Daniel (2 sep 2026). No es una restricción técnica: sacar del
  // catálogo algo que alguien está esperando deja al operador sin la ficha
  // justo cuando tiene que empacarlo, y al comprador con un pedido de un
  // producto que ya no existe.
  const estado = readFileSync("src/modules/orders/status.ts", "utf8");
  const boton = readFileSync("src/app/admin/catalogo/archive-button.tsx", "utf8");

  it('"en curso" se define UNA vez, como los confirmados', () => {
    expect(estado).toContain("export const IN_PROGRESS_STATUSES");
    expect(estado).toContain("export const inProgressFilter");
  });

  it("entregados y cancelados NO cuentan: con ellos ya no hay nada pendiente", () => {
    // Desde el `[` que ABRE el arreglo: `estado.indexOf("]")` encontraba
    // primero el de `OrderStatus[]`, y la lista salía vacía.
    const desde = estado.indexOf("IN_PROGRESS_STATUSES: OrderStatus[] = [");
    const lista = estado.slice(desde, estado.indexOf("];", desde));
    expect(lista).toContain('"PENDING"');
    expect(lista).toContain('"SHIPPED"');
    expect(lista).not.toContain('"DELIVERED"');
    expect(lista).not.toContain('"CANCELLED"');
  });

  it("la acción lo rechaza diciendo CUÁNTOS", () => {
    // "Tiene pedidos" sin número no le dice al operador si son dos que puede
    // despachar hoy o veinte.
    expect(accion).toContain("if (enCurso > 0) {");
    expect(accion).toContain("tiene ${enCurso}");
  });

  it("el modal lo avisa ANTES de pedir el motivo", () => {
    // Escribir tres líneas de motivo para que después te digan que no se
    // puede es el peor orden posible.
    expect(boton).toContain("const bloqueado = enCurso > 0");
    expect(boton).toContain("{!bloqueado && (");
  });
});

describe("un pedido no depende del producto para poder leerse", () => {
  const esquemaPedido = readFileSync("prisma/schema.prisma", "utf8");

  it("la línea del pedido guarda su propio nombre, variante y SKU", () => {
    // Es lo que hace que el historial no muestre nunca un hueco: el pedido no
    // lee el catálogo, lee lo que copió el día de la venta.
    const item = esquemaPedido.slice(
      esquemaPedido.indexOf("model OrderItem"),
      esquemaPedido.indexOf("model OrderItem") + 900,
    );
    expect(item).toMatch(/productName\s+String/);
    expect(item).toMatch(/variantName\s+String/);
    expect(item).toMatch(/sku\s+String/);
  });
});
