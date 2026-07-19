"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { upsertProduct } from "@/modules/catalog/product-actions";
import { Checkbox } from "@/components/ui/checkbox";

export type VariantDraft = {
  id?: string;
  sku: string;
  name: string;
  barcode: string;
  priceCopStore: string;
  priceCopOnline: string;
  priceUsdStore: string;
  priceUsdOnline: string;
  stockMin: string;
  initialStock: string;
  active: boolean;
  stockActual?: number; // solo informativo en edición
};

export type ProductDraft = {
  id?: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  active: boolean;
  featured: boolean;
  variants: VariantDraft[];
};

const emptyVariant = (): VariantDraft => ({
  sku: "",
  name: "",
  barcode: "",
  priceCopStore: "",
  priceCopOnline: "",
  priceUsdStore: "",
  priceUsdOnline: "",
  stockMin: "0",
  initialStock: "0",
  active: true,
});

// Estilo de input del prototipo: borde 1.6px, radio 10, focus coral
const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

export function ProductForm({
  categories,
  initial,
  onDone,
}: {
  categories: { id: string; name: string }[];
  initial?: ProductDraft;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(upsertProduct, null);
  const [product, setProduct] = useState<ProductDraft>(
    initial ?? {
      name: "",
      brand: "",
      categoryId: "",
      description: "",
      active: true,
      featured: false,
      variants: [emptyVariant()],
    },
  );

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  const setField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setProduct((p) => ({ ...p, [key]: value }));

  const setVariant = (index: number, patch: Partial<VariantDraft>) =>
    setProduct((p) => ({
      ...p,
      variants: p.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));

  const removeVariant = (index: number) =>
    setProduct((p) => ({
      ...p,
      variants: p.variants.filter((_, i) => i !== index),
    }));

  const payload = JSON.stringify({
    ...product,
    variants: product.variants.map((v) => ({ ...v, stockActual: undefined })),
  });

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="payload" value={payload} />
      {product.id && <input type="hidden" name="id" value={product.id} />}

      <div className="flex-1 space-y-4 px-7 py-6">
        {/* Uploader del prototipo — se habilita con el módulo de imágenes (esta semana) */}
        <div className="flex gap-3">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[#d9d4cc] text-[#b3b8c0]">
            <ImagePlus className="size-6" />
          </div>
          <div className="flex flex-1 items-center rounded-xl border-[1.6px] border-dashed border-[#e2ddd6] p-3 text-[12.5px] leading-relaxed text-[#8a8f98]">
            Las imágenes del producto se habilitan esta semana, junto con la
            carga del catálogo real.
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="p-name">Nombre del producto</label>
          <input
            id="p-name"
            className={inputCls}
            value={product.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Ej. Audífonos Inalámbricos"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="p-brand">Marca</label>
            <input
              id="p-brand"
              className={inputCls}
              value={product.brand}
              onChange={(e) => setField("brand", e.target.value)}
              placeholder="Kora"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-cat">Categoría</label>
            <select
              id="p-cat"
              className={`${inputCls} bg-white`}
              value={product.categoryId}
              onChange={(e) => setField("categoryId", e.target.value)}
              required
            >
              <option value="">Selecciona…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="p-desc">Descripción</label>
          <textarea
            id="p-desc"
            className={`${inputCls} min-h-20 resize-y`}
            value={product.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Se muestra en la ficha del producto"
          />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={product.active}
              onCheckedChange={(v) => setField("active", v === true)}
            />
            Activo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={product.featured}
              onCheckedChange={(v) => setField("featured", v === true)}
            />
            Destacado
          </label>
        </div>

        <div className="border-t border-[#f0ece6] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-bold text-kora-black">
              Variantes, SKU y precios
            </span>
            <button
              type="button"
              onClick={() =>
                setProduct((p) => ({ ...p, variants: [...p.variants, emptyVariant()] }))
              }
              className="flex items-center gap-1.5 rounded-lg bg-[#FFE9DD] px-3 py-1.5 text-xs font-bold text-kora-coral hover:opacity-80"
            >
              <Plus className="size-3.5" /> Agregar
            </button>
          </div>

          <div className="space-y-3">
            {product.variants.map((v, i) => (
              <div
                key={v.id ?? `new-${i}`}
                className="space-y-2.5 rounded-xl border-[1.6px] border-[#eee9e2] p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6b6f78]">
                    Variante {i + 1}
                    {v.id && (
                      <span className="ml-2 font-medium text-[#9aa0ab]">
                        Stock: {v.stockActual ?? 0} (se ajusta en Inventario)
                      </span>
                    )}
                  </span>
                  {product.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      aria-label={`Quitar variante ${i + 1}`}
                      className="flex size-7 items-center justify-center rounded-lg bg-[#faf6f2] text-[#b3b8c0] hover:text-destructive"
                    >
                      <Trash2 className="size-[15px]" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    className={inputCls}
                    value={v.name}
                    onChange={(e) => setVariant(i, { name: e.target.value })}
                    placeholder="Ej. Talla M / Única"
                    required
                  />
                  <input
                    className={inputCls}
                    value={v.sku}
                    onChange={(e) => setVariant(i, { sku: e.target.value })}
                    placeholder="SKU"
                    required
                  />
                </div>
                <input
                  className={inputCls}
                  value={v.barcode}
                  onChange={(e) => setVariant(i, { barcode: e.target.value })}
                  placeholder="Código de barras (opcional, para el POS)"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelCls}>COP tienda</label>
                    <input type="number" min="0" step="any" className={inputCls}
                      value={v.priceCopStore}
                      onChange={(e) => setVariant(i, { priceCopStore: e.target.value })}
                      placeholder="129900" required />
                  </div>
                  <div>
                    <label className={labelCls}>COP online</label>
                    <input type="number" min="0" step="any" className={inputCls}
                      value={v.priceCopOnline}
                      onChange={(e) => setVariant(i, { priceCopOnline: e.target.value })}
                      placeholder="119900" required />
                  </div>
                  <div>
                    <label className={labelCls}>USD tienda</label>
                    <input type="number" min="0" step="any" className={inputCls}
                      value={v.priceUsdStore}
                      onChange={(e) => setVariant(i, { priceUsdStore: e.target.value })}
                      placeholder="32" required />
                  </div>
                  <div>
                    <label className={labelCls}>USD online</label>
                    <input type="number" min="0" step="any" className={inputCls}
                      value={v.priceUsdOnline}
                      onChange={(e) => setVariant(i, { priceUsdOnline: e.target.value })}
                      placeholder="30" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {!v.id && (
                    <div>
                      <label className={labelCls}>Stock inicial</label>
                      <input type="number" min="0" step="1" className={inputCls}
                        value={v.initialStock}
                        onChange={(e) => setVariant(i, { initialStock: e.target.value })}
                        placeholder="20" />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Alerta stock bajo</label>
                    <input type="number" min="0" step="1" className={inputCls}
                      value={v.stockMin}
                      onChange={(e) => setVariant(i, { stockMin: e.target.value })}
                      placeholder="3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {state && !state.ok && (
          <p className="text-sm font-semibold text-destructive">{state.error}</p>
        )}
      </div>

      {/* Footer sticky del prototipo */}
      <div className="sticky bottom-0 flex gap-3 border-t border-[#f0ece6] bg-white px-7 py-4">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white py-3 text-sm font-semibold text-kora-black hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-kora-gradient flex-1 rounded-[11px] py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,90,31,0.3)] hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
