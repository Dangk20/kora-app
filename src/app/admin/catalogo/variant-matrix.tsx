"use client";

// La matriz de combinaciones: una fila por cruce de opciones.
//
// Ver openspec/changes/variantes-por-opciones — design.md decisiones 3 y 7.
//
// LO QUE DECIDE SI ESTO SE USA O NO es el bloque de "aplicar a todas". Dos
// grupos de cuatro valores son dieciséis cruces; si el operador tiene que
// teclear dieciséis veces el mismo precio, abandona y vuelve al texto libre —
// y el modelo entero queda de adorno.

import { Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  combinacionesPosibles,
  skuPropuesto,
  type OptionGroup,
} from "@/modules/catalog/options";
import type { VariantDraft } from "./product-form";
import { MoneyInput } from "./money-input";

const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 text-sm outline-none focus:border-kora-coral";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

/** ¿Esta variante corresponde a esta combinación de valores? */
function coincide(v: VariantDraft, valores: string[]): boolean {
  const suyos = v.optionValues ?? [];
  return suyos.length === valores.length && suyos.every((x, i) => x === valores[i]);
}

export function VariantMatrix({
  grupos,
  skuBase,
  variants,
  onChange,
  conStock = true,
  camposDeVenta,
}: {
  grupos: OptionGroup[];
  skuBase: string;
  variants: VariantDraft[];
  onChange: (v: VariantDraft[]) => void;
  /** `false` en el alta por pasos: el stock es el paso 3 entero. */
  conStock?: boolean;
  /** Los campos de venta del formulario, para no duplicarlos aquí. */
  camposDeVenta: (v: VariantDraft, onPatch: (p: Partial<VariantDraft>) => void) => React.ReactNode;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [bloque, setBloque] = useState({
    priceCopStore: "",
    priceCopOnline: "",
    priceUsdStore: "",
    priceUsdOnline: "",
    initialStock: "",
  });

  const combinaciones = combinacionesPosibles(grupos, skuBase);

  const patch = (valores: string[], p: Partial<VariantDraft>) =>
    onChange(variants.map((v) => (coincide(v, valores) ? { ...v, ...p } : v)));

  /** Las que el operador quitó a propósito: no se vuelven a crear solas. */
  const quitadas = useRef(new Set<string>());

  /**
   * El código base con el que se propusieron los SKU actuales.
   *
   * Sirve para una cosa concreta: escribir el código base DESPUÉS de declarar
   * las opciones —que es el orden natural— no hacía nada, porque las
   * combinaciones ya existían con su SKU. Ahora se reproponen, pero solo las
   * que siguen teniendo el SKU propuesto: si el operador escribió el código
   * del proveedor, ese no se toca.
   */
  const baseAnterior = useRef(skuBase);

  useEffect(() => {
    if (baseAnterior.current === skuBase) return;
    const previa = baseAnterior.current;
    baseAnterior.current = skuBase;

    const actualizadas = variants.map((v) => {
      const valores = v.optionValues ?? [];
      if (valores.length === 0 || v.id) return v;
      const eraPropuesto = v.sku === skuPropuesto(previa, valores);
      return eraPropuesto ? { ...v, sku: skuPropuesto(skuBase, valores) } : v;
    });
    if (actualizadas.some((v, i) => v !== variants[i])) onChange(actualizadas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuBase]);

  const quitar = (valores: string[]) => {
    quitadas.current.add(valores.join("|"));
    onChange(variants.filter((v) => !coincide(v, valores)));
  };

  /**
   * Las combinaciones se crean SOLAS al declarar los grupos.
   *
   * Antes había que pulsar "Crear" en cada una: seis clics idénticos antes de
   * poder escribir nada, y el formulario arrastraba mientras tanto una
   * variante vacía que hacía fallar el guardado con "Cada variante necesita
   * SKU" sin decir cuál. El riesgo que justificaba aquello —publicar todo en
   * cero— lo cubren los precios del bloque de arriba, que se aplican aquí.
   *
   * Lo ya escrito se conserva: se cruza por los valores, no por posición.
   */
  useEffect(() => {
    const faltan = combinaciones.filter(
      (c) =>
        !variants.some((v) => coincide(v, c.values)) &&
        !quitadas.current.has(c.values.join("|")),
    );
    // Y fuera las que ya no corresponden a ningún cruce: pasa al renombrar o
    // borrar un valor, y dejarlas mandaría al servidor variantes fantasma.
    const sobran = variants.filter(
      (v) =>
        (v.optionValues?.length ?? 0) > 0 &&
        !combinaciones.some((c) => coincide(v, c.values)),
    );
    // La variante suelta inicial —la que existe antes de declarar opciones—
    // también sobra en cuanto hay combinaciones: es la que provocaba el error.
    const sueltaInicial = variants.filter(
      (v) => !v.id && (v.optionValues?.length ?? 0) === 0,
    );

    if (faltan.length === 0 && sobran.length === 0 && sueltaInicial.length === 0) return;

    const conservadas = variants.filter(
      (v) => !sobran.includes(v) && !sueltaInicial.includes(v),
    );
    onChange([
      ...conservadas,
      ...faltan.map((c) => ({
        sku: c.sku,
        name: c.name,
        barcode: "",
        priceCopStore: bloque.priceCopStore,
        priceCopOnline: bloque.priceCopOnline,
        priceUsdStore: bloque.priceUsdStore,
        priceUsdOnline: bloque.priceUsdOnline,
        stockMin: "0",
        initialStock: bloque.initialStock || "0",
        active: true,
        optionValues: c.values,
      })),
    ]);
    // Depende de las combinaciones y de lo que ya hay; el bloque solo aporta
    // valores por omisión a las nuevas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(combinaciones.map((c) => c.values)), variants.length]);

  /** Aplica el bloque a las combinaciones YA creadas. */
  const aplicarATodas = () => {
    const cambios = Object.fromEntries(
      Object.entries(bloque).filter(([, valor]) => valor !== ""),
    );
    if (Object.keys(cambios).length === 0) return;
    onChange(
      variants.map((v) => ({
        ...v,
        ...cambios,
        // El stock inicial NO se reescribe en una variante que ya existe: su
        // stock lo lleva el motor de inventario y esto solo alimenta el
        // movimiento de creación.
        ...(v.id ? { initialStock: v.initialStock } : {}),
      })),
    );
  };

  if (combinaciones.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-[1.6px] border-dashed border-[#e2ddd6] bg-[#faf8f5] p-4">
        {/* El título solo decía "Aplicar a todas las combinaciones" y la
            explicación estaba DEBAJO del botón, donde se lee después de
            haberlo pulsado. Ahora dice qué es antes de pedir nada. */}
        <p className="text-[13px] font-bold text-kora-black">
          ¿Todas valen lo mismo?
        </p>
        <p className="mt-1 mb-3 text-[12px] leading-relaxed text-[#6b6f78]">
          Escribe el precio una vez y se copia a las{" "}
          <span className="font-semibold text-kora-black">
            {combinaciones.length} combinaciones
          </span>{" "}
          — y a las que crees después. Lo que dejes vacío no se toca, y luego
          puedes cambiar cualquiera por separado con su botón{" "}
          <span className="font-semibold text-kora-black">Editar</span>.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelCls}>COP tienda</label>
            <MoneyInput
              moneda="COP"
              value={bloque.priceCopStore}
              onChange={(crudo) => setBloque({ ...bloque, priceCopStore: crudo })}
              placeholder="129.900"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>COP online</label>
            <MoneyInput
              moneda="COP"
              value={bloque.priceCopOnline}
              onChange={(crudo) => setBloque({ ...bloque, priceCopOnline: crudo })}
              placeholder="119.900"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>USD tienda</label>
            <MoneyInput
              moneda="USD"
              value={bloque.priceUsdStore}
              onChange={(crudo) => setBloque({ ...bloque, priceUsdStore: crudo })}
              placeholder="32.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>USD online</label>
            <MoneyInput
              moneda="USD"
              value={bloque.priceUsdOnline}
              onChange={(crudo) => setBloque({ ...bloque, priceUsdOnline: crudo })}
              placeholder="30.00"
              className={inputCls}
            />
          </div>
          {conStock && (
            <div>
              <label className={labelCls}>Stock inicial</label>
              <input type="number" min="0" step="1" className={inputCls}
                value={bloque.initialStock}
                onChange={(e) => setBloque({ ...bloque, initialStock: e.target.value })}
                placeholder="10" />
            </div>
          )}
        </div>

        {/* Centrado y sin ocupar todo el ancho: es una acción opcional, no el
            botón principal del paso. */}
        <div className="mt-3.5 flex justify-center">
          <button
            type="button"
            onClick={aplicarATodas}
            className="rounded-full bg-kora-black px-8 py-2.5 text-[13px] font-bold text-white hover:bg-kora-gray-dark"
          >
            Copiar a las {combinaciones.length}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {combinaciones.map((c) => {
          const existente = variants.find((v) => coincide(v, c.values));
          const clave = c.values.join("|");

          // Sin `existente` no hay fila: la combinación se quitó a propósito.
          if (!existente) return null;

          if (abierta === clave) {
            return (
              <div
                key={clave}
                className="space-y-2.5 rounded-xl border-[1.6px] border-kora-coral p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-kora-black">{c.name}</span>
                  {!existente.id && (
                    <button
                      type="button"
                      onClick={() => {
                        quitar(c.values);
                        setAbierta(null);
                      }}
                      className="text-[12px] font-semibold text-[#8a8f98] hover:text-destructive"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {camposDeVenta(existente, (p) => patch(c.values, p))}
                <button
                  type="button"
                  onClick={() => setAbierta(null)}
                  className="w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] py-2.5 text-[13px] font-semibold text-kora-black hover:bg-muted"
                >
                  Listo
                </button>
              </div>
            );
          }

          const incompleta = !existente.sku.trim() || !existente.priceCopOnline;
          return (
            <div
              key={clave}
              className="flex items-center gap-3 rounded-xl border-[1.6px] border-[#eee9e2] px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-kora-black">{c.name}</div>
                <div className="truncate text-[11.5px] text-[#9aa0ab]">
                  {existente.sku.trim() || "Sin SKU"}
                  {existente.priceCopOnline &&
                    ` · $${Number(existente.priceCopOnline).toLocaleString("es-CO")}`}
                  {existente.id
                    ? ` · Stock ${existente.stockActual ?? 0}`
                    : existente.initialStock && ` · Stock ${existente.initialStock}`}
                </div>
              </div>
              {incompleta && (
                <span className="shrink-0 rounded-full bg-[#FFF4EF] px-2 py-1 text-[10.5px] font-bold text-kora-coral">
                  Falta información
                </span>
              )}
              <button
                type="button"
                onClick={() => setAbierta(clave)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-kora-coral hover:bg-[#FFF4EF]"
              >
                <Pencil className="size-[14px]" /> Editar
              </button>
              {/* Quitar es la EXCEPCIÓN —"la 44 solo vino en negro"—, así que
                  es un icono discreto y no una decisión que haya que tomar
                  seis veces antes de empezar. */}
              {!existente.id && (
                <button
                  type="button"
                  onClick={() => quitar(c.values)}
                  aria-label={`Quitar la combinación ${c.name}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#faf6f2] text-[#b3b8c0] hover:text-destructive"
                >
                  <X className="size-[15px]" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
