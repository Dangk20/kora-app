// El alta de producto NO se cierra ni se envía sin que el operador lo pida.
//
// Reunión con el cliente del 13 sep 2026: "al diligenciar el paso 2 el modal
// se cierra como si guardara, sin pasar al paso 3". Reproducido en local el
// 19 sep: eran tres fallos, ninguno con error.
//
//  1. Arrastrar una selección de texto desde un campo hasta fuera del panel
//     disparaba `click` en el fondo, que cerraba el modal sin guardar.
//  2. Mantener Enter un instante: la autorrepetición avanzaba al paso 3 y
//     enviaba en la misma pulsación. Producto guardado sin stock.
//  3. Tras crear, la URL pasaba a `?editar=<id>` pero React reutilizaba la
//     misma instancia del modal, con el estado viejo sin `id`: sin caja de
//     fotos, y un segundo "Guardar" volvía a crear (conflicto de SKU, o un
//     duplicado si se cambiaba el SKU).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decidirEnter, guardaDeFondo } from "@/app/admin/catalogo/form-guards";

const fondo = {};
const panel = {};

describe("el fondo del modal cierra solo si el clic empezó y terminó en él", () => {
  it("un clic limpio en el fondo cierra", () => {
    let cerrado = 0;
    const g = guardaDeFondo(() => cerrado++);
    g.onMouseDown({ target: fondo, currentTarget: fondo });
    g.onClick({ target: fondo, currentTarget: fondo });
    expect(cerrado).toBe(1);
  });

  it("una selección que empieza en un campo y suelta en el fondo NO cierra", () => {
    let cerrado = 0;
    const g = guardaDeFondo(() => cerrado++);
    g.onMouseDown({ target: panel, currentTarget: fondo });
    // El navegador dispara `click` en el ancestro común: el fondo.
    g.onClick({ target: fondo, currentTarget: fondo });
    expect(cerrado).toBe(0);
  });

  it("un arrastre que empieza en el fondo y suelta dentro del panel tampoco", () => {
    let cerrado = 0;
    const g = guardaDeFondo(() => cerrado++);
    g.onMouseDown({ target: fondo, currentTarget: fondo });
    g.onClick({ target: panel, currentTarget: fondo });
    expect(cerrado).toBe(0);
  });

  it("no arrastra memoria: el siguiente clic se juzga solo", () => {
    let cerrado = 0;
    const g = guardaDeFondo(() => cerrado++);
    g.onMouseDown({ target: fondo, currentTarget: fondo });
    g.onClick({ target: panel, currentTarget: fondo });
    // Sin mousedown nuevo en el fondo, un click suelto no cierra.
    g.onClick({ target: fondo, currentTarget: fondo });
    expect(cerrado).toBe(0);
  });
});

describe("Enter en el alta por pasos", () => {
  const base = {
    porPasos: true,
    esAlta: true,
    paso: 1,
    ultimoPaso: 2,
    repeat: false,
    enAreaDeTexto: false,
    enBoton: false,
    enPasoOculto: false,
  };

  it("en un alta, avanza de paso", () => {
    expect(decidirEnter(base)).toBe("avanzar");
    expect(decidirEnter({ ...base, paso: 0 })).toBe("avanzar");
  });

  it("en el último paso, envía", () => {
    expect(decidirEnter({ ...base, paso: 2 })).toBe("enviar");
  });

  it("en una edición, envía desde cualquier paso", () => {
    expect(decidirEnter({ ...base, esAlta: false, paso: 0 })).toBe("enviar");
  });

  it("la autorrepetición se ignora: mantener la tecla no atraviesa los pasos", () => {
    expect(decidirEnter({ ...base, repeat: true })).toBe("ignorar");
    expect(decidirEnter({ ...base, repeat: true, paso: 2 })).toBe("ignorar");
  });

  it("un Enter que llega a un campo de un paso ya oculto se ignora", () => {
    // Es el keydown que llega al campo desde el que se acaba de avanzar,
    // antes de que el navegador le quite el foco.
    expect(decidirEnter({ ...base, paso: 2, enPasoOculto: true })).toBe("ignorar");
  });

  it("en un área de texto o sobre un botón, el navegador hace lo suyo", () => {
    expect(decidirEnter({ ...base, enAreaDeTexto: true })).toBe("dejar");
    expect(decidirEnter({ ...base, enBoton: true })).toBe("dejar");
  });

  it("fuera del recorrido por pasos no interviene", () => {
    expect(decidirEnter({ ...base, porPasos: false })).toBe("dejar");
  });
});

describe("las guardas siguen cableadas", () => {
  it("el modal usa la guarda de fondo, no un onClick={close} directo", () => {
    const modal = readFileSync("src/app/admin/catalogo/product-modal.tsx", "utf8");
    expect(modal).toContain("guardaDeFondo(");
    expect(modal).toContain("onMouseDown={fondo.onMouseDown}");
    expect(modal).toContain("onClick={fondo.onClick}");
    expect(modal).not.toMatch(/onClick=\{close\}\s*\n\s*>/);
  });

  it("el formulario decide Enter con decidirEnter y le pasa `repeat`", () => {
    const form = readFileSync("src/app/admin/catalogo/product-form.tsx", "utf8");
    expect(form).toContain("decidirEnter({");
    expect(form).toContain("repeat: e.repeat");
    expect(form).toContain("enPasoOculto:");
  });

  it("el modal lleva `key` por producto: crear y luego guardar no vuelve a crear", () => {
    const page = readFileSync("src/app/admin/catalogo/page.tsx", "utf8");
    expect(page).toMatch(/<ProductModal\s+key=\{sheetInitial\?\.id \?\? "nuevo"\}/);
  });
});
