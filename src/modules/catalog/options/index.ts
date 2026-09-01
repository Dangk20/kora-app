// Opciones de un producto y las combinaciones que producen.
//
// Ver openspec/changes/variantes-por-opciones — specs/product-options.
//
// Funciones PURAS: reciben datos y devuelven datos. Las consultas viven en
// `queries.ts`. Se separan porque estas son las reglas que hay que poder
// probar sin base de datos, y porque son las que se equivocan en silencio.

/** Un grupo con sus valores: Talla → M, S. */
export type OptionGroup = {
  id?: string;
  name: string;
  values: { id?: string; value: string }[];
};

/** Una combinación: un valor por grupo, en el orden de los grupos. */
export type Combination = {
  /** Los valores que la componen, uno por grupo. */
  values: string[];
  /** Nombre visible: "M · Azul". */
  name: string;
  /** SKU propuesto: "CAM-M-AZUL". */
  sku: string;
};

/** Lo que separa los valores en el nombre visible de una variante. */
const SEPARADOR = " · ";

/**
 * El nombre visible de una variante a partir de sus valores.
 *
 * ÚNICA función que lo compone. Se guarda en `variant.name`, que leen 23
 * sitios —carrito, pedidos, correos, WhatsApp, POS—: con dos implementaciones,
 * la del comprobante y la del carrito se separan y nadie lo nota hasta que un
 * comprador pregunta por qué su correo dice otra cosa.
 */
export function nombreDeCombinacion(valores: string[]): string {
  const limpios = valores.map((v) => v.trim()).filter(Boolean);
  // Sin valores, es el producto simple de siempre.
  return limpios.length ? limpios.join(SEPARADOR) : "Única";
}

/**
 * Normaliza un texto para usarlo dentro de un SKU: mayúsculas, sin tildes,
 * sin espacios.
 *
 * ⚠️ NO abrevia, y es deliberado. "AZ" para "Azul" parece más limpio hasta que
 * entra "Azufre": dos productos distintos compartirían SKU y el inventario
 * dejaría de cuadrar SIN dar ningún error. Un código largo y sin ambigüedad se
 * puede reemplazar a mano; uno ambiguo no se puede detectar.
 */
export function paraSku(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "CAM" + ["M", "Azul"] → "CAM-M-AZUL". Sin base, solo los valores. */
export function skuPropuesto(base: string, valores: string[]): string {
  return [paraSku(base), ...valores.map(paraSku)].filter(Boolean).join("-");
}

/**
 * Todas las combinaciones que producen estos grupos (producto cartesiano).
 *
 * PROPONE; no crea nada. Un producto con Talla (M, S) y Color (Azul, Rojo)
 * tiene cuatro combinaciones posibles, y el operador decide cuáles existen:
 * crearlas todas con precio y stock en cero publicaría un producto donde todo
 * se ve disponible y nada se puede comprar.
 */
export function combinacionesPosibles(
  grupos: OptionGroup[],
  skuBase = "",
): Combination[] {
  const conValores = grupos.filter((g) => g.values.some((v) => v.value.trim()));
  if (conValores.length === 0) return [];

  let acumulado: string[][] = [[]];
  for (const grupo of conValores) {
    const valores = grupo.values.map((v) => v.value.trim()).filter(Boolean);
    acumulado = acumulado.flatMap((previo) => valores.map((v) => [...previo, v]));
  }

  return acumulado.map((valores) => ({
    values: valores,
    name: nombreDeCombinacion(valores),
    sku: skuPropuesto(skuBase, valores),
  }));
}

/** Una variante ya existente, vista desde la ficha. */
export type VarianteConOpciones = {
  id: string;
  /** Sus valores, uno por grupo, en el orden de los grupos. */
  values: string[];
  /** Cupo online. 0 = no se puede comprar. */
  onlineUnits: number;
};

/**
 * Qué variante corresponde a una selección de valores.
 *
 * `null` cuando esa combinación no existe — que desde el lado del comprador es
 * lo mismo que agotada: no se puede comprar. La diferencia solo le importa al
 * operador.
 */
export function variantePara(
  variantes: VarianteConOpciones[],
  seleccion: (string | null)[],
): VarianteConOpciones | null {
  if (seleccion.some((v) => !v)) return null;
  return (
    variantes.find(
      (v) =>
        v.values.length === seleccion.length &&
        v.values.every((valor, i) => valor === seleccion[i]),
    ) ?? null
  );
}

/**
 * Qué valores de un grupo siguen siendo alcanzables dada la selección actual.
 *
 * Un valor es alcanzable si existe ALGUNA variante con cupo que lo contenga y
 * que respete lo ya elegido en los demás grupos. Lo que no es alcanzable se
 * tacha: ofrecer un color que no se puede comprar traslada el error al final
 * del embudo, cuando el comprador ya decidió.
 */
export function valoresAlcanzables(
  variantes: VarianteConOpciones[],
  grupos: OptionGroup[],
  seleccion: (string | null)[],
  indiceGrupo: number,
): Set<string> {
  const alcanzables = new Set<string>();
  for (const v of variantes) {
    if (v.onlineUnits <= 0) continue;
    // Debe respetar lo elegido en los OTROS grupos; el propio se ignora,
    // porque es el que se está evaluando.
    const compatible = seleccion.every(
      (elegido, i) => i === indiceGrupo || !elegido || v.values[i] === elegido,
    );
    if (compatible && v.values[indiceGrupo]) alcanzables.add(v.values[indiceGrupo]);
  }
  void grupos;
  return alcanzables;
}
