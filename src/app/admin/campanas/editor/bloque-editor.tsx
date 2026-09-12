"use client";

// Las propiedades de un bloque, según su tipo.

import { useState } from "react";
import { Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCampaignImage } from "@/modules/campaigns/actions";
import type { Block } from "@/modules/campaigns/blocks";
import { MAX_PRODUCTOS } from "@/modules/campaigns/types";
import { ProductPicker } from "../../vitrina/product-picker";
import { ErrorTexto, inputCls, labelCls } from "./ui";

export function EditorDeBloque({
  block,
  nombres,
  urls,
  onChange,
  onProductPicked,
  onUploaded,
}: {
  block: Block;
  nombres: Record<string, string>;
  urls: Record<string, string>;
  onChange: (c: Partial<Block>) => void;
  onProductPicked: (p: { id: string; name: string }) => void;
  onUploaded: (key: string, url: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  switch (block.type) {
    case "title":
      return (
        <input autoFocus value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          className={inputCls} placeholder="El titular del correo" />
      );
    case "text":
      return (
        <textarea autoFocus rows={5} value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          className={`${inputCls} resize-y`} placeholder="Separa los párrafos con una línea en blanco." />
      );
    case "button":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Texto</label>
            <input autoFocus value={block.label} onChange={(e) => onChange({ label: e.target.value } as Partial<Block>)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Enlace</label>
            <input value={block.url} onChange={(e) => onChange({ url: e.target.value } as Partial<Block>)}
              className={inputCls} placeholder="https://korashopp.com/catalogo" />
          </div>
        </div>
      );
    case "image": {
      const url = block.imageKey ? urls[block.imageKey] : null;
      return (
        <div>
          {url ? (
            // Miniatura de lo recién subido, entera (sin recortar): es para
            // comprobar QUÉ se subió. La real la sirve el correo.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="mb-2 max-h-40 w-full rounded-[10px] bg-[#faf8f5] object-contain" />
          ) : (
            <p className="mb-2 text-[12px] text-muted-foreground">JPG, PNG o WebP hasta 5 MB. Se guarda a 1200 px de ancho, en JPEG.</p>
          )}
          <input type="file" accept="image/*" disabled={subiendo}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setSubiendo(true);
              setErrorSubida(null);
              const fd = new FormData();
              fd.set("image", f);
              const r = await uploadCampaignImage(fd);
              setSubiendo(false);
              if (r.ok) onUploaded(r.imageKey, r.url);
              else setErrorSubida(r.error);
            }}
            className="block w-full text-[12.5px] file:mr-3 file:rounded-full file:border-0 file:bg-[#f5f3f0] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold" />
          {subiendo && <p className="mt-1 text-[12px] text-muted-foreground">Subiendo…</p>}
          {errorSubida && <ErrorTexto>{errorSubida}</ErrorTexto>}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Texto alternativo</label>
              <input value={block.alt} onChange={(e) => onChange({ alt: e.target.value } as Partial<Block>)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Enlace al hacer clic (opcional)</label>
              <input value={block.linkUrl} onChange={(e) => onChange({ linkUrl: e.target.value } as Partial<Block>)} className={inputCls} placeholder="https://…" />
            </div>
          </div>
        </div>
      );
    }
    case "products":
      return (
        <div>
          <ul className="mb-2 space-y-1">
            {block.productIds.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 rounded-[8px] bg-[#faf8f5] px-3 py-1.5 text-[13px]">
                <span className="truncate">{nombres[id] ?? id}</span>
                <button type="button" aria-label="Quitar"
                  onClick={() => onChange({ productIds: block.productIds.filter((x) => x !== id) } as Partial<Block>)}
                  className="text-[#b3b8c0] hover:text-destructive"><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)} disabled={block.productIds.length >= MAX_PRODUCTOS}>
            <Package className="size-3.5" /> Añadir producto ({block.productIds.length}/{MAX_PRODUCTOS})
          </Button>
          {picker && (
            <ProductPicker
              title="Añadir producto al correo"
              excludeIds={block.productIds}
              onClose={() => setPicker(false)}
              onPick={(p) => { onProductPicked(p); setPicker(false); }}
            />
          )}
        </div>
      );
    case "spacer":
      return (
        <div className="flex gap-2">
          {([16, 32, 48] as const).map((h) => (
            <button key={h} type="button" onClick={() => onChange({ height: h } as Partial<Block>)}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${block.height === h ? "border-kora-coral bg-kora-coral/10 text-kora-coral" : "border-[#e2ddd6] text-[#6b6f78]"}`}>
              {h === 16 ? "Pequeño" : h === 32 ? "Medio" : "Grande"}
            </button>
          ))}
        </div>
      );
    case "divider":
      return <p className="text-[12.5px] text-muted-foreground">Una línea fina entre bloques. No tiene opciones.</p>;
  }
}
