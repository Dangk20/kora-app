"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Check, ImagePlus, Package, Tags } from "lucide-react";
import { upsertProduct } from "@/modules/catalog/product-actions";
import { quickCreateCategory } from "@/modules/catalog/category-actions";
import { Switch } from "@/components/ui/switch";
import { nombreDeCombinacion, type OptionGroup } from "@/modules/catalog/options";
import { OptionBuilder } from "./option-builder";
import { VariantMatrix } from "./variant-matrix";
import { CamposDeVenta } from "./sale-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** Los valores que la componen, uno por grupo. Vacío = variante suelta. */
  optionValues?: string[];
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
  /** Grupos de opciones declarados: Talla → M, S. */
  options?: OptionGroup[];
  /** Código base del que se proponen los SKU de las combinaciones. */
  skuBase?: string;
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
  optionValues: [],
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

const PASOS = [
  { titulo: "Qué es", ayuda: "Cómo se llama, de qué categoría es y cómo se ve.", Icono: Package },
  { titulo: "Cómo se vende", ayuda: "Sus opciones, sus códigos y sus precios.", Icono: Tags },
  { titulo: "Cuánto hay", ayuda: "Las unidades con las que arranca cada una.", Icono: Boxes },
] as const;

/** La barra de pasos. Siempre visible: saber dónde se está evita abandonar. */
function PasosCabecera({
  paso,
  onIr,
}: {
  paso: number;
  onIr: (i: number) => void;
}) {
  return (
    <div className="border-b border-[#f0ece6] bg-[#faf8f5] px-7 py-4">
      <div className="flex items-stretch gap-2">
        {PASOS.map((p, i) => {
          const hecho = i < paso;
          const actual = i === paso;
          const { Icono } = p;
          return (
            <button
              key={p.titulo}
              type="button"
              onClick={() => onIr(i)}
              aria-current={actual ? "step" : undefined}
              className={`flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                actual
                  ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                  : "hover:bg-white/70"
              }`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] ${
                  actual
                    ? "bg-kora-gradient text-white"
                    : hecho
                      ? "bg-[#FFE9DD] text-kora-coral"
                      : "bg-[#f0ece6] text-[#b3b8c0]"
                }`}
              >
                {hecho ? <Check className="size-[18px]" /> : <Icono className="size-[18px]" />}
              </span>
              <div className="min-w-0">
                <p
                  className={`truncate text-[13px] font-bold ${
                    actual || hecho ? "text-kora-black" : "text-[#b3b8c0]"
                  }`}
                >
                  {i + 1}. {p.titulo}
                </p>
                {actual && (
                  <p className="truncate text-[11.5px] text-[#8a8f98]">{p.ayuda}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Un bloque del formulario. Oculto se QUEDA MONTADO —`hidden`, no desmontado—
 * para que volver atrás encuentre lo que ya se escribió: desmontarlo tiraría
 * el estado de los campos no controlados en cuanto alguien pulse "Atrás".
 */
function Bloque({
  paso,
  visible,
  children,
}: {
  paso: number;
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-paso={paso} className={visible ? "space-y-4" : "hidden"}>
      {children}
    </div>
  );
}

/**
 * Paso 3: cuántas unidades entran de cada combinación.
 *
 * Vive aparte de los precios a propósito: cargar el catálogo y contar el
 * inventario son dos trabajos, a menudo de dos personas. Y es el único paso
 * que toca el libro de inventario — el stock entra por `receiveStock()`.
 */
function PasoStock({
  variants,
  conVariantes,
  onChange,
}: {
  variants: VariantDraft[];
  conVariantes: boolean;
  onChange: (indice: number, initialStock: string) => void;
}) {
  const nuevas = variants.filter((v) => !v.id);

  if (nuevas.length === 0) {
    return (
      <p className="rounded-xl bg-[#faf8f5] px-4 py-6 text-center text-[13px] text-[#6b6f78]">
        Este producto ya existe: su stock se ajusta desde{" "}
        <span className="font-semibold text-kora-black">Inventario</span>, que deja
        constancia de cada movimiento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-[#6b6f78]">
        {conVariantes
          ? "Cuántas unidades tienes hoy de cada combinación. Todo lo que cargues aquí queda publicado en la tienda; el reparto entre tienda y online se afina después en Inventario."
          : "Cuántas unidades tienes hoy. Puedes dejarlo en cero y cargarlas después desde Inventario."}
      </p>

      <div className="space-y-2">
        {variants.map((v, i) =>
          v.id ? null : (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border-[1.6px] border-[#eee9e2] px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-kora-black">
                  {v.optionValues?.length
                    ? nombreDeCombinacion(v.optionValues)
                    : v.name.trim() || "Única"}
                </div>
                <div className="truncate text-[11.5px] text-[#9aa0ab]">
                  {v.sku.trim() || "Sin SKU"}
                </div>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={v.initialStock}
                onChange={(e) => onChange(i, e.target.value)}
                placeholder="0"
                className="w-24 rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 text-right text-sm tabular-nums outline-none focus:border-kora-coral"
              />
              <span className="w-16 shrink-0 text-[12px] text-[#8a8f98]">unidades</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function ProductForm({
  categories,
  initial,
  onDone,
  /**
   * `"pasos"` = alta guiada en el modal grande. `"panel"` = todo junto en el
   * slide-over, que es para entrar a cambiar UNA cosa.
   *
   * Es el mismo componente y no dos, a propósito: con dos implementaciones del
   * alta y la edición, un campo nuevo entra en una y no en la otra, y el
   * producto creado desde un sitio sale distinto del creado desde el otro.
   */
  modo = "panel",
}: {
  categories: CategoryNode[];
  initial?: ProductDraft;
  onDone: () => void;
  modo?: "panel" | "pasos";
}) {
  const porPasos = modo === "pasos";
  const [paso, setPaso] = useState(0);
  /** En un ALTA se avanza; en una EDICIÓN se guarda desde donde se esté. */
  const esAlta = !initial;
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

  /**
   * ¿Este producto se vende en varias presentaciones?
   *
   * Apagado es lo normal —una camiseta suelta, un balón— y entonces el
   * operador no ve la palabra "variante" en ninguna parte: llena un SKU, sus
   * precios y su stock, y ya. Por debajo SIEMPRE hay una variante, porque los
   * precios y el stock cuelgan de ella en la base; se llama "Única" y el
   * operador no tiene por qué saberlo.
   *
   * Al editar, se enciende solo si el producto ya tiene más de una.
   */
  const [conVariantes, setConVariantes] = useState(
    (initial?.variants.length ?? 1) > 1,
  );

  const [confirmarSimple, setConfirmarSimple] = useState(false);

  const [grupos, setGrupos] = useState<OptionGroup[]>(initial?.options ?? []);
  const [skuBase, setSkuBase] = useState(initial?.skuBase ?? "");

  /**
   * Encender o apagar las variantes.
   *
   * Apagarlo con varias cargadas BORRA todas menos la primera, así que se
   * pregunta antes. Hacerlo en silencio sería tirar trabajo del operador por
   * haber tocado un interruptor, que es la clase de pérdida que no se puede
   * deshacer y que además no se nota hasta guardar.
   */
  const alternarVariantes = (v: boolean) => {
    if (!v && product.variants.length > 1) {
      setConfirmarSimple(true);
      return;
    }
    setConVariantes(v);
  };

  const volverASimple = () => {
    setProduct((p) => ({ ...p, variants: p.variants.slice(0, 1) }));
    setConVariantes(false);
    setConfirmarSimple(false);
  };
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

  const payload = JSON.stringify({
    ...product,
    // La subcategoría manda; si no hay, el producto cuelga de la categoría padre.
    categoryId: subId || parentId,
    // Sin variantes, el producto SIGUE teniendo una en la base: los precios y
    // el stock cuelgan de ella. Se llama "Única" y el operador nunca la ve —
    // no tiene por qué saber que existe para vender un balón.
    // Los grupos solo viajan si las variantes están encendidas: un producto
    // simple no tiene opciones, y mandarlas vacías crearía grupos huérfanos.
    options: conVariantes
      ? grupos
          .filter((g) => g.name.trim() && g.values.some((v) => v.value.trim()))
          .map((g) => ({
            name: g.name.trim(),
            values: g.values.map((v) => v.value.trim()).filter(Boolean),
          }))
      : [],
    variants: (conVariantes ? product.variants : product.variants.slice(0, 1)).map((v) => ({
      ...v,
      // El nombre lo compone SIEMPRE la misma función, desde los valores: es
      // lo que leen los 23 sitios que muestran una variante.
      name: conVariantes
        ? v.optionValues?.length
          ? nombreDeCombinacion(v.optionValues)
          : v.name
        : v.name.trim() || "Única",
      optionValues: conVariantes ? (v.optionValues ?? []) : [],
      stockActual: undefined,
    })),
  });

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="payload" value={payload} />
      {product.id && <input type="hidden" name="id" value={product.id} />}

      {porPasos && <PasosCabecera paso={paso} onIr={setPaso} />}

      <div className="flex-1 space-y-4 px-7 py-6">
        <Bloque paso={0} visible={!porPasos || paso === 0}>
        {/* Galería (uploader del prototipo). Necesita un producto ya creado:
            las fotos cuelgan de su id. */}
        {product.id ? (
          <ImageUploader productId={product.id} initial={product.images ?? []} />
        ) : (
          <div className="flex gap-3">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[#d9d4cc] text-[#b3b8c0]">
              <ImagePlus className="size-6" />
            </div>
            {/* Aquí todavía no se puede subir —las fotos cuelgan del id del
                producto—, pero sí decir QUÉ preparar: quien está creando el
                producto es quien tiene las fotos a mano, y enterarse del
                tamaño después obliga a rehacerlas. */}
            <div className="flex flex-1 flex-col justify-center rounded-xl border-[1.6px] border-dashed border-[#e2ddd6] p-3 text-[12.5px] leading-relaxed text-[#8a8f98]">
              <span>Guarda el producto y podrás agregarle fotos.</span>
              <span className="mt-0.5">
                Ve preparándolas:{" "}
                <span className="font-semibold text-[#6b6f78]">
                  1200 × 1200 px, cuadradas, fondo claro
                </span>{" "}
                · JPG, PNG, WebP o AVIF · máx. 5 MB c/u.
              </span>
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
        {/* Interruptores, no casillas: una casilla marcada se lee como
            "seleccionado en una lista"; un interruptor se lee como "esto está
            encendido", que es lo que significan Activo y Destacado. Y es el
            mismo componente que el switch del listado, así que el panel dice
            lo mismo de la misma forma en los dos sitios. */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Switch
            checked={product.active}
            onCheckedChange={(v) => setField("active", v)}
            label="Activo"
            apagado="Inactivo"
          />
          <Switch
            checked={product.featured}
            onCheckedChange={(v) => setField("featured", v)}
            label="Destacado"
          />
        </div>
        </Bloque>

        <Bloque paso={1} visible={!porPasos || paso === 1}>
        <div className={porPasos ? "" : "border-t border-[#f0ece6] pt-4"}>
          {/* El interruptor manda: apagado, la palabra "variante" no aparece
              en ninguna parte y el operador llena un SKU, sus precios y su
              stock. Es el caso normal —un balón, una crema— y antes obligaba a
              entender un concepto que no necesitaba. */}
          <Switch
            checked={conVariantes}
            onCheckedChange={alternarVariantes}
            label="Este producto tiene variantes"
            encendido="Sí"
            apagado="No"
          />
          <p className="mt-1.5 mb-4 text-[12px] leading-relaxed text-[#8a8f98]">
            {conVariantes
              ? "Tallas, colores o presentaciones. Cada una lleva su SKU, sus precios y su stock."
              : "Un solo SKU, un solo precio y un solo stock. Enciéndelo si vendes tallas, colores o presentaciones."}
          </p>

          {!conVariantes ? (
            <CamposDeVenta
              v={product.variants[0]}
              onChange={(patch) => setVariant(0, patch)}
              conStock={!porPasos}
            />
          ) : (
            <div className="space-y-4">
              {/* El padre con sus hijos: Talla → M, S. */}
              <div>
                <p className="mb-2 text-[13px] font-bold text-kora-black">
                  Opciones del producto
                </p>
                <OptionBuilder grupos={grupos} onChange={setGrupos} />
              </div>

              {grupos.some((g) => g.name.trim() && g.values.some((v) => v.value.trim())) && (
                <div>
                  <div className="mb-3">
                    <label className={labelCls} htmlFor="sku-base">
                      Código base para los SKU
                    </label>
                    <input
                      id="sku-base"
                      className={inputCls}
                      value={skuBase}
                      onChange={(e) => setSkuBase(e.target.value)}
                      placeholder="Ej. CAM"
                    />
                    {/* Se propone en vez de pedirlo dieciséis veces: con dos
                        grupos de cuatro valores son dieciséis SKU, y teclearlos
                        a mano es lo que hace que el operador abandone. */}
                    <p className="mt-1 text-[11.5px] text-[#8a8f98]">
                      De aquí salen los SKU de cada combinación —{" "}
                      <span className="font-semibold">
                        {skuBase.trim()
                          ? `${skuBase.trim().toUpperCase()}-M-AZUL`
                          : "CAM-M-AZUL"}
                      </span>{" "}
                      — y cada uno se puede cambiar.
                    </p>
                  </div>

                  <p className="mb-2 text-[13px] font-bold text-kora-black">Combinaciones</p>
                  <VariantMatrix
                    grupos={grupos}
                    skuBase={skuBase}
                    variants={product.variants}
                    onChange={(vs) => setProduct((p) => ({ ...p, variants: vs }))}
                    conStock={!porPasos}
                    camposDeVenta={(v, onPatch) => (
                      <CamposDeVenta v={v} onChange={onPatch} conStock={!porPasos} />
                    )}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Apagar el interruptor con varias variantes borra todas menos la
            primera. Cancelar es el botón dominante, igual que en el resto de
            la tienda: quien lo tocó por accidente tiene delante lo que no
            rompe nada. */}
        <Dialog open={confirmarSimple} onOpenChange={setConfirmarSimple}>
          <DialogContent
            overlayClassName="z-[80] bg-[rgba(14,15,18,0.45)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            className="z-[90] rounded-2xl border-none p-0 shadow-[0_28px_60px_-18px_rgba(22,24,29,0.35)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[380px] motion-reduce:duration-0"
          >
            <div className="px-6 pt-6">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-[17px] font-bold text-kora-black">
                  ¿Quitar las variantes?
                </DialogTitle>
                <DialogDescription className="text-[13.5px] leading-relaxed text-[#6b7280]">
                  Este producto tiene {product.variants.length} variantes. Se quedará solo con la
                  primera —{" "}
                  <span className="font-semibold text-kora-black">
                    {product.variants[0]?.name.trim() || "la de arriba"}
                  </span>{" "}
                  — y las demás se descartarán.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex flex-col gap-2 px-6 pt-5 pb-6">
              <button
                type="button"
                onClick={() => setConfirmarSimple(false)}
                className="w-full rounded-full bg-kora-black px-6 py-3.5 text-[14.5px] font-bold text-white transition-colors hover:bg-kora-gray-dark"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={volverASimple}
                className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                Sí, dejar una sola
              </button>
            </div>
          </DialogContent>
        </Dialog>
        </Bloque>

        <Bloque paso={2} visible={porPasos && paso === 2}>
          <PasoStock
            variants={product.variants}
            conVariantes={conVariantes}
            onChange={(i, initialStock) => setVariant(i, { initialStock })}
          />
        </Bloque>

        {state && !state.ok && (
          <p className="text-sm font-semibold text-destructive">{state.error}</p>
        )}
      </div>

      {/* Footer sticky del prototipo */}
      <div className="sticky bottom-0 flex gap-3 border-t border-[#f0ece6] bg-white px-7 py-4">
        <button
          type="button"
          onClick={porPasos && esAlta && paso > 0 ? () => setPaso(paso - 1) : onDone}
          className="flex-1 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white py-3 text-sm font-semibold text-kora-black hover:bg-muted"
        >
          {porPasos && esAlta && paso > 0 ? "Atrás" : "Cancelar"}
        </button>
        {porPasos && esAlta && paso < 2 ? (
          // `type="button"`: sin esto, un Enter en cualquier campo enviaría el
          // formulario a medio recorrido y guardaría un producto sin stock.
          <button
            type="button"
            onClick={() => setPaso(paso + 1)}
            className="bg-kora-gradient flex-1 rounded-[11px] py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,90,31,0.3)] hover:opacity-90"
          >
            Siguiente
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            onClick={(e) => {
              // Con las pestañas navegables, un campo obligatorio del paso 1
              // puede estar OCULTO al guardar desde el 3. El navegador bloquea
              // el envío y no puede enseñar el mensaje —no se puede enfocar lo
              // que no se ve—, así que el botón parecería no hacer nada.
              // Se salta al paso del primer campo inválido y ahí sí se enseña.
              const form = e.currentTarget.form;
              if (!form || form.checkValidity()) return;
              e.preventDefault();
              const invalido = form.querySelector(":invalid");
              const bloque = invalido?.closest<HTMLElement>("[data-paso]");
              if (bloque?.dataset.paso) setPaso(Number(bloque.dataset.paso));
              // Tras el repintado: antes, el campo sigue oculto.
              requestAnimationFrame(() => form.reportValidity());
            }}
            className="bg-kora-gradient flex-1 rounded-[11px] py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,90,31,0.3)] hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar producto"}
          </button>
        )}
      </div>
    </form>
  );
}
