// Añade opciones —tallas, colores, lo que sea— a un producto de una sola variante.
//
//   pnpm variants:add KHR-0001 --talla S,M,L --color Negro,Blanco [--stock 2] [--actor correo]
//
// Cada `--grupo valores` es un grupo de opción; se crean TODAS las
// combinaciones (talla × color) que el producto no tenga, con el SKU y el
// nombre que propone el módulo de opciones (`KHR-0001-M-NEGRO`, "M · Negro"),
// los mismos precios que la variante original, stock por el motor de
// inventario —nunca a mano— y enlazadas a sus valores. La variante original
// pasa a ser la combinación de su talla con el primer valor de cada otro
// grupo, para que no quede una variante "sin color" en un producto con
// colores. Idempotente: lo que ya existe se salta.
//
// Nació el 12 sep 2026 para probar en pruebas el selector de opciones con el
// catálogo real, que es de piezas únicas. Sirve igual el día que el cliente
// reciba varias tallas o colores de un mismo modelo.

import "dotenv/config";
import { db } from "../src/lib/db";
import { ensureVariantOption } from "../src/modules/catalog/import/options";
import { combinacionesPosibles, nombreDeCombinacion, skuPropuesto } from "../src/modules/catalog/options";
import { receiveStock } from "../src/modules/inventory/engine";

const RESERVADAS = new Set(["stock", "actor"]);

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

async function main() {
  const args = process.argv.slice(2);
  const skuBase = args.find((a) => !a.startsWith("--"));
  const stock = args.includes("--stock") ? Number(args[args.indexOf("--stock") + 1]) : 1;
  const actorEmail = args.includes("--actor") ? args[args.indexOf("--actor") + 1] : "admin@kora.local";

  const grupos: { name: string; values: string[] }[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const nombre = a.slice(2).toLowerCase();
    if (RESERVADAS.has(nombre)) { i++; continue; }
    const valores = (args[i + 1] ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    if (valores.length === 0) continue;
    grupos.push({ name: capitalizar(nombre), values: valores });
    i++;
  }
  if (!skuBase || grupos.length === 0) {
    console.error("Uso: pnpm variants:add <SKU> --talla S,M,L [--color Negro,Blanco] [--stock n] [--actor correo]");
    process.exit(1);
  }

  const actor = await db.user.findUnique({ where: { email: actorEmail } });
  if (!actor) { console.error(`No existe el usuario ${actorEmail}.`); process.exit(1); }

  const base = await db.variant.findUnique({
    where: { sku: skuBase.toUpperCase() },
    include: { product: { select: { id: true, name: true } } },
  });
  if (!base) { console.error(`No existe la variante ${skuBase}.`); process.exit(1); }

  // La talla original entra al grupo Talla si no estaba en la lista.
  const tallaBase = base.name.replace(/^Talla\s+/i, "").trim();
  const grupoTalla = grupos.find((g) => g.name === "Talla");
  if (grupoTalla && tallaBase && !/^[uú]nica$/i.test(tallaBase) && !grupoTalla.values.some((v) => v.toLowerCase() === tallaBase.toLowerCase())) {
    grupoTalla.values.unshift(tallaBase);
  }

  // La variante original = su talla + el primer valor de cada otro grupo.
  const valoresBase = grupos.map((g) => (g.name === "Talla" && tallaBase && !/^[uú]nica$/i.test(tallaBase) ? tallaBase : g.values[0]));
  await db.$transaction(async (tx) => {
    for (const [i, g] of grupos.entries()) await ensureVariantOption(tx, base.id, g.name, valoresBase[i]);
    await tx.variant.update({ where: { id: base.id }, data: { name: nombreDeCombinacion(valoresBase) } });
  });

  const skuRaiz = base.sku.replace(new RegExp(`-${valoresBase.map((v) => v.toUpperCase()).join("-")}$`), "");
  let creadas = 0;
  for (const combo of combinacionesPosibles(grupos.map((g) => ({ name: g.name, values: g.values.map((value) => ({ value })) })))) {
    const valores = combo.values;
    if (valores.every((v, i) => v.toLowerCase() === valoresBase[i].toLowerCase())) continue;
    const sku = skuPropuesto(skuRaiz, valores);
    const existe = await db.variant.findUnique({ where: { sku }, select: { id: true } });
    if (existe) {
      await db.$transaction(async (tx) => { for (const [i, g] of grupos.entries()) await ensureVariantOption(tx, existe.id, g.name, valores[i]); });
      continue;
    }
    await db.$transaction(async (tx) => {
      const v = await tx.variant.create({
        data: {
          productId: base.productId,
          sku,
          name: nombreDeCombinacion(valores),
          priceCopStore: base.priceCopStore,
          priceCopOnline: base.priceCopOnline,
          priceUsdStore: base.priceUsdStore,
          priceUsdOnline: base.priceUsdOnline,
          active: true,
        },
        select: { id: true },
      });
      if (stock > 0) {
        await receiveStock(tx, { variantId: v.id, qty: stock, actorId: actor.id, note: `${nombreDeCombinacion(valores)} añadida a ${base.sku}`, allOnline: true });
      }
      for (const [i, g] of grupos.entries()) await ensureVariantOption(tx, v.id, g.name, valores[i]);
    });
    creadas += 1;
  }
  console.log(`✔ "${base.product.name}": ${creadas} combinación(es) nueva(s) con ${stock} unidad(es) cada una · ${grupos.map((g) => `${g.name}: ${g.values.join("/")}`).join(" · ")}`);
  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
