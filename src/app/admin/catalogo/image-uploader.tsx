"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import {
  deleteProductImage,
  makePrimaryImage,
  uploadProductImages,
  type ImageActionResult,
} from "@/modules/catalog/image-actions";

export type ProductImage = { id: string; url: string; alt: string | null };

/**
 * Galería del slide-over: la primera imagen es la que se ve en la tienda.
 * Solo aparece en edición — un producto necesita existir para colgarle fotos.
 */
export function ImageUploader({
  productId,
  initial,
}: {
  productId: string;
  initial: ProductImage[];
}) {
  const [images, setImages] = useState<ProductImage[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `product-images-${productId}`;

  const [uploadState, upload, uploading] = useActionState<ImageActionResult, FormData>(
    uploadProductImages,
    null,
  );
  const [deleteState, remove, deleting] = useActionState<ImageActionResult, FormData>(
    deleteProductImage,
    null,
  );
  const [primaryState, setPrimary, settingPrimary] = useActionState<
    ImageActionResult,
    FormData
  >(makePrimaryImage, null);

  // Estas acciones se disparan desde botones, no desde un <form action>: sin
  // startTransition React no actualiza sus flags de pendiente.
  const [, startTransition] = useTransition();
  const dispatch = (action: (fd: FormData) => void, fd: FormData) =>
    startTransition(() => action(fd));

  useEffect(() => {
    for (const state of [uploadState, deleteState, primaryState]) {
      if (!state) continue;
      if (state.ok) {
        setImages(state.images);
        setError(null);
      } else {
        setError(state.error);
      }
    }
  }, [uploadState, deleteState, primaryState]);

  const busy = uploading || deleting || settingPrimary;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2.5">
        {images.map((img, i) => (
          <div
            key={img.id}
            className="group relative size-20 overflow-hidden rounded-xl border-[1.6px] border-[#eee9e2]"
          >
            <Image
              src={img.url}
              alt={img.alt ?? ""}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
            {i === 0 && (
              <span className="bg-kora-gradient absolute top-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white">
                Principal
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              {i !== 0 && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Hacer principal"
                  title="Hacer principal"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("imageId", img.id);
                    dispatch(setPrimary, fd);
                  }}
                  className="flex size-7 items-center justify-center rounded-lg bg-white/90 text-kora-black hover:bg-white"
                >
                  <Star className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                aria-label="Eliminar imagen"
                title="Eliminar"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("imageId", img.id);
                  dispatch(remove, fd);
                }}
                className="flex size-7 items-center justify-center rounded-lg bg-white/90 text-destructive hover:bg-white"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        <label
          htmlFor={inputId}
          aria-disabled={busy}
          className="flex size-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#d9d4cc] text-[#b3b8c0] hover:border-kora-coral hover:text-kora-coral aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="size-5" />
              <span className="text-[10px] font-semibold">Subir</span>
            </>
          )}
        </label>
      </div>

      <p className="text-[11.5px] leading-relaxed text-[#8a8f98]">
        JPG, PNG, WebP o AVIF · máximo 5 MB c/u. La primera imagen es la que se
        ve en la tienda; pasa el cursor sobre otra para hacerla principal.
      </p>
      {error && <p className="text-[11.5px] font-semibold text-destructive">{error}</p>}

      {/* Input fuera del <form> del producto: sube por su propia action.
          Se abre con un <label>, no con .click() por JavaScript, que en
          algunos navegadores no dispara el selector si el input está oculto. */}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          const fd = new FormData();
          fd.set("productId", productId);
          for (const file of files) fd.append("images", file);
          dispatch(upload, fd);
          e.target.value = "";
        }}
      />
    </div>
  );
}
