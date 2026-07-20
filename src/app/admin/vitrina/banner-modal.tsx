"use client";

// Administrador de un espacio publicitario: lista las piezas cargadas, y
// permite agregar, editar, reordenar y eliminar. Con varias piezas la tienda
// las rota sola.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteBanner,
  moveBanner,
  saveBanner,
  type ShowcaseResult,
} from "@/modules/showcase/actions";
import type { ResolvedBanner } from "@/modules/showcase/queries";
import { ProductPicker } from "./product-picker";
import type { SlotDef } from "./banner-control";

export function BannerModal({
  def,
  banners,
  onClose,
}: {
  def: SlotDef;
  banners: ResolvedBanner[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ResolvedBanner | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const run = (fn: () => Promise<ShowcaseResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(14,15,18,0.55)] p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-[560px] max-w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={def.title}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f0ece6] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-kora-black">{def.title}</h3>
            <p className="mt-0.5 text-[11.5px] leading-snug text-[#8a8f98]">
              {def.hint} {banners.length > 1 && "Las piezas rotan solas cada 5 segundos."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-4" />
          </button>
        </div>

        {editing ? (
          <BannerForm
            def={def}
            banner={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
              {banners.length === 0 ? (
                <div className="rounded-[12px] border-2 border-dashed border-[#e2ddd6] px-4 py-10 text-center">
                  <ImagePlus className="mx-auto size-8 text-[#d9d4cc]" />
                  <p className="mt-2 text-[13px] font-semibold text-kora-black">
                    Este espacio está vacío
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[#9aa0ab]">
                    Agrega una o varias piezas; si son varias, rotarán solas.
                  </p>
                </div>
              ) : (
                banners.map((b, i) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-[12px] border border-[#f0ece6] p-2.5"
                  >
                    <span className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#f7f4f0]">
                      {b.imageUrl && (
                        <Image
                          src={b.imageUrl}
                          alt={b.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-kora-black">
                        Pieza {i + 1}
                        {!b.active && (
                          <span className="ml-2 rounded-full bg-[#f0ece6] px-2 py-0.5 text-[10px] font-bold text-[#8a8f98]">
                            Oculta
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1 truncate text-[11.5px] text-[#8a8f98]">
                        {b.productName ? (
                          <>
                            <Link2 className="size-3 shrink-0 text-kora-coral" />
                            {b.productName}
                          </>
                        ) : (
                          "Sin enlace"
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Subir"
                      disabled={pending || i === 0}
                      onClick={() => run(() => moveBanner(b.id, "up"))}
                      className="flex size-7 items-center justify-center rounded bg-[#f5f3f0] text-[#6b6f78] hover:text-kora-black disabled:opacity-30"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Bajar"
                      disabled={pending || i === banners.length - 1}
                      onClick={() => run(() => moveBanner(b.id, "down"))}
                      className="flex size-7 items-center justify-center rounded bg-[#f5f3f0] text-[#6b6f78] hover:text-kora-black disabled:opacity-30"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Editar pieza ${i + 1}`}
                      onClick={() => setEditing(b)}
                      className="flex size-7 items-center justify-center rounded bg-[#f5f3f0] text-[#6b6f78] hover:text-kora-black"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar pieza ${i + 1}`}
                      disabled={pending}
                      onClick={() => run(() => deleteBanner(b.id))}
                      className="flex size-7 items-center justify-center rounded bg-[#faf6f2] text-[#b3b8c0] hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}

              {error && (
                <p className="text-[12.5px] font-semibold text-destructive">{error}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#f0ece6] px-5 py-4">
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="flex items-center gap-2 rounded-[11px] bg-kora-black px-4 py-2.5 text-[13px] font-bold text-white hover:bg-kora-gray-dark"
              >
                <Plus className="size-4" /> Agregar pieza
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[11px] border-[1.6px] border-[#e2ddd6] px-5 py-2.5 text-[13px] font-semibold text-kora-black hover:bg-muted"
              >
                Listo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Alta o edición de una pieza. */
function BannerForm({
  def,
  banner,
  onDone,
  onCancel,
}: {
  def: SlotDef;
  banner: ResolvedBanner | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, saving] = useActionState<ShowcaseResult | null, FormData>(
    saveBanner,
    null,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(banner?.imageUrl ?? null);
  const [productId, setProductId] = useState(banner?.productId ?? "");
  const [productLabel, setProductLabel] = useState<string | null>(
    banner?.productName ?? null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `banner-image-${def.slot}-${banner?.id ?? "nuevo"}`;

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  };

  /** Al soltar hay que meter el archivo en el input: el form envía FormData. */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !inputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    takeFile(file);
  };

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="slot" value={def.slot} />
      <input type="hidden" name="title" value={def.title} />
      <input type="hidden" name="productId" value={productId} />
      {banner && <input type="hidden" name="bannerId" value={banner.id} />}

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-[#6b6f78]">
            Imagen de la pieza
          </p>
          {/* Un <label> abre el selector de forma nativa. */}
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative flex h-[180px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[12px] border-2 border-dashed bg-[#faf8f5] transition-colors ${
              dragging
                ? "border-kora-coral bg-[#FFF4EF]"
                : "border-[#e2ddd6] hover:border-kora-coral"
            }`}
          >
            {preview ? (
              <>
                <Image
                  src={preview}
                  alt=""
                  fill
                  sizes="440px"
                  className="object-cover"
                  unoptimized
                />
                <span className="absolute right-2 bottom-2 rounded-full bg-kora-black/85 px-3 py-1.5 text-[11.5px] font-bold text-white">
                  Cambiar imagen
                </span>
              </>
            ) : (
              <span className="text-center">
                <ImagePlus className="mx-auto size-8 text-[#b3b8c0]" />
                <span className="mt-2 block text-[13px] font-semibold text-kora-black">
                  {fileName ?? "Haz clic para elegir una imagen"}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[#9aa0ab]">
                  o arrástrala aquí · JPG, PNG, WebP o AVIF · máx. 5 MB
                </span>
              </span>
            )}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => takeFile(e.target.files?.[0])}
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-[#9aa0ab]">
            {def.ratio}. La pieza debe traer su propio texto: el sistema solo la
            muestra y la enlaza.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-[#6b6f78]">
            ¿A qué producto lleva?
          </p>
          {productLabel ? (
            <div className="flex items-center gap-2 rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 py-2.5">
              <Link2 className="size-4 shrink-0 text-kora-coral" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-kora-black">
                {productLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  setProductId("");
                  setProductLabel(null);
                }}
                className="text-[11.5px] font-semibold text-kora-coral hover:opacity-80"
              >
                Quitar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full rounded-[11px] border-[1.6px] border-dashed border-[#e2ddd6] px-3.5 py-2.5 text-left text-[13px] text-[#8a8f98] hover:border-kora-coral"
            >
              Elegir producto (opcional)
            </button>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-[13px] text-kora-black">
          <input
            type="checkbox"
            name="active"
            defaultChecked={banner?.active ?? true}
            className="accent-kora-coral"
          />
          Mostrar esta pieza en la tienda
        </label>

        {state && !state.ok && (
          <p className="text-[12.5px] font-semibold text-destructive">{state.error}</p>
        )}
      </div>

      <div className="flex gap-2.5 border-t border-[#f0ece6] px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-[11px] border-[1.6px] border-[#e2ddd6] py-2.5 text-[13.5px] font-semibold text-kora-black hover:bg-muted"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-[11px] bg-kora-black py-2.5 text-[13.5px] font-bold text-white hover:bg-kora-gray-dark disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {banner ? "Guardar cambios" : "Agregar pieza"}
        </button>
      </div>

      {pickerOpen && (
        <ProductPicker
          title="Enlazar a un producto"
          onClose={() => setPickerOpen(false)}
          onPick={(product) => {
            setProductId(product.id);
            setProductLabel(product.name);
            setPickerOpen(false);
          }}
        />
      )}
    </form>
  );
}
