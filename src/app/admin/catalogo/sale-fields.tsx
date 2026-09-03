"use client";

// Los campos con los que se VENDE algo: SKU, código de barras, los cuatro
// precios y el stock.
//
// Viven aquí, fuera del formulario, porque los usan tres sitios: el panel de
// edición, el alta por pasos y la matriz de combinaciones. Escritos por
// separado, basta que alguien añada un precio en uno para que los otros dejen
// de pedirlo y el producto se publique sin precio en una divisa — sin que nada
// falle.

import type { VariantDraft } from "./product-form";
import { MoneyInput } from "./money-input";

const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

/**
 * Los campos con los que se VENDE algo: SKU, código de barras, los cuatro
 * precios y el stock.
 *
 * Uno solo para los dos modos —producto simple y variante— porque son
 * exactamente los mismos campos. Escritos dos veces, basta que alguien
 * añada un precio en uno para que el otro deje de pedirlo, y el producto se
 * publique sin precio en una divisa sin que nada falle.
 */
export function CamposDeVenta({
  v,
  onChange,
  /**
   * `false` en el alta por pasos: ahí el stock es el paso 3 entero, y pedirlo
   * también aquí lo convierte en dos sitios donde escribir lo mismo — con la
   * garantía de que uno de los dos queda con el número viejo.
   */
  conStock = true,
}: {
  v: VariantDraft;
  onChange: (patch: Partial<VariantDraft>) => void;
  conStock?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>SKU</label>
          <input
            className={inputCls}
            value={v.sku}
            onChange={(e) => onChange({ sku: e.target.value })}
            placeholder="Ej. TEC-0001"
            required
          />
        </div>
        <div>
          <label className={labelCls}>
            Código de barras <span className="font-normal text-[#9aa0ab]">(opcional)</span>
          </label>
          <input
            className={inputCls}
            value={v.barcode}
            onChange={(e) => onChange({ barcode: e.target.value })}
            placeholder="Para el POS"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>COP tienda</label>
          <MoneyInput
            moneda="COP"
            value={v.priceCopStore}
            onChange={(crudo) => onChange({ priceCopStore: crudo })}
            placeholder="129.900"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>COP online</label>
          <MoneyInput
            moneda="COP"
            value={v.priceCopOnline}
            onChange={(crudo) => onChange({ priceCopOnline: crudo })}
            placeholder="119.900"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>USD tienda</label>
          <MoneyInput
            moneda="USD"
            value={v.priceUsdStore}
            onChange={(crudo) => onChange({ priceUsdStore: crudo })}
            placeholder="32.00"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>USD online</label>
          <MoneyInput
            moneda="USD"
            value={v.priceUsdOnline}
            onChange={(crudo) => onChange({ priceUsdOnline: crudo })}
            placeholder="30.00"
            className={inputCls}
            required
          />
        </div>
      </div>

      {conStock && (
      <div className="grid grid-cols-2 gap-2.5">
        {!v.id && (
          <div>
            <label className={labelCls}>Stock inicial</label>
            <input type="number" min="0" step="1" className={inputCls}
              value={v.initialStock}
              onChange={(e) => onChange({ initialStock: e.target.value })}
              placeholder="20" />
          </div>
        )}
        <div>
          <label className={labelCls}>Alerta stock bajo</label>
          <input type="number" min="0" step="1" className={inputCls}
            value={v.stockMin}
            onChange={(e) => onChange({ stockMin: e.target.value })}
            placeholder="3" />
        </div>
      </div>
      )}
    </div>
  );
}
