"use client";

// Paso 2: el diseño. Bloques que se ARRASTRAN desde la paleta al lienzo, y
// dentro del lienzo para reordenarlos; el correo a la derecha se actualiza
// solo. Arrastrar y soltar es del navegador (HTML5), sin librería: son cuatro
// eventos, y las flechas siguen ahí para quien no arrastra —o no puede—.

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Heading1,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  Package,
  StretchVertical,
  Text,
  Trash2,
} from "lucide-react";
import {
  BLOCK_LABEL,
  BLOCK_TYPES,
  MAX_BLOCKS,
  newBlock,
  type Block,
  type BlockType,
} from "@/modules/campaigns/blocks";
import { EditorDeBloque } from "./bloque-editor";
import { Previa } from "./previa";
import { Seccion } from "./ui";

const ICONO: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  title: Heading1,
  text: Text,
  image: ImageIcon,
  button: MousePointerClick,
  products: Package,
  divider: Minus,
  spacer: StretchVertical,
};

/** Tipos MIME propios: así un arrastre ajeno (un archivo, un texto) no cae aquí. */
const MIME_NUEVO = "application/x-kora-block-type";
const MIME_MOVER = "application/x-kora-block-id";

export function PasoDiseno({
  blocks,
  onBlocks,
  nombres,
  onNombres,
  urls,
  onUrls,
  html,
  renderizando,
  faltantes,
  error,
}: {
  blocks: Block[];
  onBlocks: (b: Block[]) => void;
  nombres: Record<string, string>;
  onNombres: (n: Record<string, string>) => void;
  urls: Record<string, string>;
  onUrls: (u: Record<string, string>) => void;
  html: string;
  renderizando: boolean;
  faltantes: string[];
  error: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  // ── Operaciones ──
  const actualizar = (id: string, cambio: Partial<Block>) =>
    onBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...cambio } as Block) : b)));
  const quitar = (id: string) => {
    onBlocks(blocks.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
  };
  const insertar = (type: BlockType, en: number) => {
    if (blocks.length >= MAX_BLOCKS) return;
    const b = newBlock(type);
    const copia = [...blocks];
    copia.splice(en, 0, b);
    onBlocks(copia);
    setSelected(b.id);
  };
  const moverA = (id: string, en: number) => {
    const desde = blocks.findIndex((b) => b.id === id);
    if (desde < 0) return;
    const copia = [...blocks];
    const [b] = copia.splice(desde, 1);
    // Si se quita uno de antes, el destino se corre una posición.
    copia.splice(desde < en ? en - 1 : en, 0, b);
    onBlocks(copia);
  };
  const mover = (id: string, delta: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const copia = [...blocks];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onBlocks(copia);
  };

  // ── Arrastrar y soltar ──
  const soltar = (e: React.DragEvent, en: number) => {
    e.preventDefault();
    setSobre(null);
    setArrastrando(null);
    const tipo = e.dataTransfer.getData(MIME_NUEVO) as BlockType | "";
    const id = e.dataTransfer.getData(MIME_MOVER);
    if (tipo && BLOCK_TYPES.includes(tipo)) insertar(tipo, en);
    else if (id) moverA(id, en);
  };
  const permitir = (e: React.DragEvent, en: number) => {
    if (!e.dataTransfer.types.includes(MIME_NUEVO) && !e.dataTransfer.types.includes(MIME_MOVER)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(MIME_NUEVO) ? "copy" : "move";
    if (sobre !== en) setSobre(en);
  };

  return (
    <div className="flex min-h-0 flex-1 gap-0">
      {/* ── Izquierda: paleta y lienzo ── */}
      <div className="flex w-[460px] shrink-0 flex-col overflow-y-auto border-r border-[#eee9e2] bg-white px-5 py-5">
        {error && (
          <p role="alert" className="mb-4 rounded-[10px] bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]">{error}</p>
        )}

        <Seccion titulo="Bloques" nota="arrástralos al correo">
          <div className="grid grid-cols-4 gap-2">
            {BLOCK_TYPES.map((t) => {
              const Icono = ICONO[t];
              const lleno = blocks.length >= MAX_BLOCKS;
              return (
                <button
                  key={t}
                  type="button"
                  draggable={!lleno}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MIME_NUEVO, t);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => insertar(t, blocks.length)}
                  disabled={lleno}
                  title="Arrastra al correo, o haz clic para añadir al final"
                  className="flex cursor-grab flex-col items-center gap-1.5 rounded-[12px] border-[1.6px] border-dashed border-[#e2ddd6] px-2 py-3 text-[11.5px] font-semibold text-[#6b6f78] transition-colors hover:border-kora-coral hover:text-kora-coral active:cursor-grabbing disabled:opacity-40"
                >
                  <Icono className="size-[18px]" />
                  {BLOCK_LABEL[t]}
                </button>
              );
            })}
          </div>
        </Seccion>

        <Seccion titulo="El correo" nota={`${blocks.length}/${MAX_BLOCKS} bloques`}>
          <p className="mb-3 text-[12px] text-muted-foreground">
            La cabecera KORA y el pie legal van siempre. Esto es lo de en medio.
          </p>

          <Zona en={0} activa={sobre === 0} vacia={blocks.length === 0} onOver={permitir} onDrop={soltar} onLeave={() => setSobre(null)} />

          {blocks.map((b, i) => {
            const Icono = ICONO[b.type];
            const abierto = selected === b.id;
            const esElArrastrado = arrastrando === b.id;
            return (
              <div key={b.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MIME_MOVER, b.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastrando(b.id);
                  }}
                  onDragEnd={() => { setArrastrando(null); setSobre(null); }}
                  className={`rounded-[12px] border-[1.6px] bg-white transition-opacity ${abierto ? "border-kora-coral" : "border-[#eee9e2]"} ${esElArrastrado ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-1.5 px-2 py-2">
                    <span className="cursor-grab text-[#c9c3ba] active:cursor-grabbing" title="Arrastra para mover" aria-hidden>
                      <GripVertical className="size-4" />
                    </span>
                    <button type="button" onClick={() => setSelected(abierto ? null : b.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <Icono className="size-4 shrink-0 text-[#8a8f98]" />
                      <span className="truncate text-[13px] font-semibold text-kora-black">{resumen(b, nombres)}</span>
                    </button>
                    <IconBtn label="Subir" onClick={() => mover(b.id, -1)} disabled={i === 0}><ArrowUp className="size-3.5" /></IconBtn>
                    <IconBtn label="Bajar" onClick={() => mover(b.id, 1)} disabled={i === blocks.length - 1}><ArrowDown className="size-3.5" /></IconBtn>
                    <IconBtn label="Quitar" onClick={() => quitar(b.id)} peligro><Trash2 className="size-3.5" /></IconBtn>
                  </div>
                  {abierto && (
                    <div className="border-t border-[#f0ece6] px-3 py-3">
                      <EditorDeBloque
                        block={b}
                        nombres={nombres}
                        urls={urls}
                        onChange={(c) => actualizar(b.id, c)}
                        onProductPicked={(p) => {
                          onNombres({ ...nombres, [p.id]: p.name });
                          if (b.type === "products") actualizar(b.id, { productIds: [...b.productIds, p.id] } as Partial<Block>);
                        }}
                        onUploaded={(key, url) => {
                          onUrls({ ...urls, [key]: url });
                          actualizar(b.id, { imageKey: key } as Partial<Block>);
                        }}
                      />
                    </div>
                  )}
                </div>
                <Zona en={i + 1} activa={sobre === i + 1} vacia={false} onOver={permitir} onDrop={soltar} onLeave={() => setSobre(null)} />
              </div>
            );
          })}
        </Seccion>
      </div>

      {/* ── Derecha: el correo ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f3efe9] px-6 py-4 [background-image:radial-gradient(#dcd5cb_1px,transparent_1px)] [background-size:18px_18px]">
        <p className="mb-1 text-[12.5px] text-muted-foreground">
          {renderizando ? "Actualizando…" : "Es el mismo correo que se envía"}
          {faltantes.length > 0 && (
            <span className="ml-2 text-kora-coral">
              {faltantes.length} producto{faltantes.length === 1 ? "" : "s"} ya no está{faltantes.length === 1 ? "" : "n"} en el catálogo
            </span>
          )}
        </p>
        <Previa html={html} />
      </div>
    </div>
  );
}

/**
 * Un hueco entre bloques donde se puede soltar. Fino cuando nada se arrastra
 * encima; se abre cuando algo lo sobrevuela, para que se vea DÓNDE va a caer.
 * Sin bloques, es el lienzo entero.
 */
function Zona({ en, activa, vacia, onOver, onDrop, onLeave }: {
  en: number;
  activa: boolean;
  vacia: boolean;
  onOver: (e: React.DragEvent, en: number) => void;
  onDrop: (e: React.DragEvent, en: number) => void;
  onLeave: () => void;
}) {
  if (vacia) {
    return (
      <div
        onDragOver={(e) => onOver(e, en)}
        onDragLeave={onLeave}
        onDrop={(e) => onDrop(e, en)}
        className={`flex h-32 items-center justify-center rounded-[12px] border-2 border-dashed text-center text-[13px] transition-colors ${activa ? "border-kora-coral bg-[#FFF4EF] text-kora-coral" : "border-[#e2ddd6] bg-[#faf8f5] text-muted-foreground"}`}
      >
        {activa ? "Suelta aquí" : "Arrastra un bloque aquí, o haz clic en uno de arriba"}
      </div>
    );
  }
  return (
    <div
      onDragOver={(e) => onOver(e, en)}
      onDragLeave={onLeave}
      onDrop={(e) => onDrop(e, en)}
      className={`transition-all ${activa ? "my-1 h-10 rounded-[10px] border-2 border-dashed border-kora-coral bg-[#FFF4EF]" : "h-2"}`}
      aria-hidden
    />
  );
}

function IconBtn({ label, onClick, disabled, peligro, children }: {
  label: string; onClick: () => void; disabled?: boolean; peligro?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`flex size-7 items-center justify-center rounded-lg text-[#b3b8c0] transition-colors disabled:opacity-30 ${peligro ? "hover:bg-[#fdecec] hover:text-destructive" : "hover:bg-[#FFE9DD] hover:text-kora-coral"}`}>
      {children}
    </button>
  );
}

export function resumen(b: Block, nombres: Record<string, string>): string {
  switch (b.type) {
    case "title": return b.text.trim() || "Título (vacío)";
    case "text": return b.text.trim().split("\n")[0]?.slice(0, 60) || "Texto (vacío)";
    case "image": return b.imageKey ? "Imagen" : "Imagen (sin subir)";
    case "button": return b.label.trim() ? `Botón: ${b.label.trim()}` : "Botón";
    case "products": return b.productIds.length === 0 ? "Productos (ninguno)" : b.productIds.map((id) => nombres[id] ?? "…").join(", ");
    case "divider": return "Separador";
    case "spacer": return `Espacio ${b.height === 16 ? "pequeño" : b.height === 32 ? "medio" : "grande"}`;
  }
}
