"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Plus, Trash2 } from "lucide-react";
import { upsertProduct } from "@/modules/catalog/product-actions";
import { quickCreateCategory } from "@/modules/catalog/category-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUploader, type ProductImage } from "./image-uploader";

export type CategoryNode = {
  id: string;
  name: string;
  children: { id: string; name: string }[];
};

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
  images?: ProductImage[];
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

/**
 * Modo creación en el lugar del select (patrón Wenú): al elegir
 * "+ Crear nueva…" en el dropdown, el select se convierte en este input
 * con su botón de confirmar.
 */
function InlineCreate({
  placeholder,
  confirmLabel,
  parentId,
  onCreated,
  onCancel,
}: {
  placeholder: string;
  confirmLabel: string;
  parentId?: string;
  onCreated: (cat: { id: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await quickCreateCategory({ name, parentId });
      if (result.ok) {
        onCreated({ id: result.id, name: result.name });
      } else {
        setError(result.error);
      }
    });

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            create();
          }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        autoFocus
        className="border-kora-coral w-full rounded-[10px] border-[1.6px] px-3.5 py-3 text-sm outline-none"
      />
      <button
        type="button"
        onClick={create}
        disabled={pending || name.trim().length < 2}
        className="bg-kora-gradient flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        <Check className="size-4" /> {pending ? "Creando…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full text-center text-[11.5px] text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

const NEW_OPTION = "__nueva__";

export function ProductForm({
  categories,
  initial,
  onDone,
}: {
  categories: CategoryNode[];
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

  // Árbol local: permite agregar categorías recién creadas sin recargar.
  const [cats, setCats] = useState<CategoryNode[]>(categories);

  // El categoryId guardado puede ser un padre o un hijo — resolver ambos.
  const resolve = (categoryId: string) => {
    for (const p of cats) {
      if (p.id === categoryId) return { parentId: p.id, subId: "" };
      if (p.children.some((c) => c.id === categoryId)) {
        return { parentId: p.id, subId: categoryId };
      }
    }
    return { parentId: "", subId: "" };
  };
  const [{ parentId, subId }, setCategorySel] = useState(() =>
    resolve(initial?.categoryId ?? ""),
  );
  const [creating, setCreating] = useState<"parent" | "sub" | null>(null);
  const parent = cats.find((p) => p.id === parentId);

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
    // La subcategoría manda; si no hay, el producto cuelga de la categoría padre.
    categoryId: subId || parentId,
    variants: product.variants.map((v) => ({ ...v, stockActual: undefined })),
  });

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="payload" value={payload} />
      {product.id && <input type="hidden" name="id" value={product.id} />}

      <div className="flex-1 space-y-4 px-7 py-6">
        {/* Galería (uploader del prototipo). Necesita un producto ya creado:
            las fotos cuelgan de su id. */}
        {product.id ? (
          <ImageUploader productId={product.id} initial={product.images ?? []} />
        ) : (
          <div className="flex gap-3">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[#d9d4cc] text-[#b3b8c0]">
              <ImagePlus className="size-6" />
            </div>
            <div className="flex flex-1 items-center rounded-xl border-[1.6px] border-dashed border-[#e2ddd6] p-3 text-[12.5px] leading-relaxed text-[#8a8f98]">
              Guarda el producto y podrás agregarle fotos.
            </div>
          </div>
        )}

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
        <div className="grid grid-cols-2 items-start gap-3">
          <div>
            <label className={labelCls} htmlFor="p-cat">Categoría</label>
            {creating === "parent" ? (
              <InlineCreate
                placeholder="Nombre de la nueva categoría"
                confirmLabel="Confirmar categoría"
                onCreated={(cat) => {
                  setCats((prev) => [...prev, { ...cat, children: [] }]);
                  setCategorySel({ parentId: cat.id, subId: "" });
                  setCreating(null);
                  router.refresh();
                }}
                onCancel={() => setCreating(null)}
              />
            ) : (
              <select
                id="p-cat"
                className={`${inputCls} bg-white`}
                value={parentId}
                onChange={(e) => {
                  if (e.target.value === NEW_OPTION) {
                    setCreating("parent");
                  } else {
                    setCategorySel({ parentId: e.target.value, subId: "" });
                  }
                }}
                required
              >
                <option value="">Selecciona una categoría</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW_OPTION}>+ Crear nueva categoría</option>
              </select>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="p-sub">Subcategoría</label>
            {creating === "sub" && parent ? (
              <InlineCreate
                placeholder={`Nueva subcategoría de ${parent.name}`}
                confirmLabel="Confirmar subcategoría"
                parentId={parent.id}
                onCreated={(cat) => {
                  setCats((prev) =>
                    prev.map((p) =>
                      p.id === parent.id
                        ? { ...p, children: [...p.children, cat] }
                        : p,
                    ),
                  );
                  setCategorySel({ parentId: parent.id, subId: cat.id });
                  setCreating(null);
                  router.refresh();
                }}
                onCancel={() => setCreating(null)}
              />
            ) : (
              <select
                id="p-sub"
                className={`${inputCls} bg-white disabled:opacity-50`}
                value={subId}
                onChange={(e) => {
                  if (e.target.value === NEW_OPTION) {
                    setCreating("sub");
                  } else {
                    setCategorySel({ parentId, subId: e.target.value });
                  }
                }}
                disabled={!parent}
              >
                <option value="">
                  {parent ? "Sin subcategoría" : "Elige categoría primero"}
                </option>
                {parent?.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {parent && (
                  <option value={NEW_OPTION}>+ Crear nueva subcategoría</option>
                )}
              </select>
            )}
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
