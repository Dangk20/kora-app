"use client";

// El constructor de campañas: bloques a la izquierda, el correo a la derecha.
//
// La vista previa NO tiene maqueta propia: cada cambio pide al servidor el
// mismo `renderCampaignFor` del envío, con un pequeño retraso tras la última
// tecla. Lo que el operador ve es lo que recibe el destinatario — una vista
// previa dibujada aparte sería la primera cosa que se desincroniza y la última
// que alguien nota.
//
// Reordenar es con flechas, no arrastrando: es lo que hace Vitrina y basta
// para 5–10 bloques.

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Heading1,
  Image as ImageIcon,
  Minus,
  Monitor,
  MousePointerClick,
  Package,
  Send,
  Smartphone,
  StretchVertical,
  Text,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  estimateAudience,
  previewCampaign,
  saveCampaign,
  sendTestEmail,
  uploadCampaignImage,
} from "@/modules/campaigns/actions";
import {
  BLOCK_LABEL,
  BLOCK_TYPES,
  MAX_BLOCKS,
  newBlock,
  type Block,
  type BlockType,
} from "@/modules/campaigns/blocks";
import { MAX_ASUNTO, MAX_PREHEADER, MAX_PRODUCTOS, type Segment } from "@/modules/campaigns/types";
import { ProductPicker } from "../../vitrina/product-picker";

type Opcion = { id: string; name: string };

const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-kora-coral";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

const ICONO: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  title: Heading1,
  text: Text,
  image: ImageIcon,
  button: MousePointerClick,
  products: Package,
  divider: Minus,
  spacer: StretchVertical,
};

const ACTIVIDAD: { value: Segment["activity"]; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activos_30", label: "Compraron en 30 días" },
  { value: "activos_60", label: "Compraron en 60 días" },
  { value: "activos_90", label: "Compraron en 90 días" },
  { value: "inactivos_90", label: "Sin comprar hace +90 días" },
  { value: "sin_compras", label: "Nunca han comprado" },
];

export function Builder({
  campaign,
  initialBlocks,
  productNames,
  imageUrls,
  categorias,
}: {
  campaign: { id: string; name: string; subject: string; preheader: string; segment: Segment } | null;
  initialBlocks: Block[];
  productNames: Record<string, string>;
  imageUrls: Record<string, string>;
  categorias: Opcion[];
}) {
  const router = useRouter();

  const [name, setName] = useState(campaign?.name ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [preheader, setPreheader] = useState(campaign?.preheader ?? "");
  const [segment, setSegment] = useState<Segment>(
    campaign?.segment ?? { country: "ambos", activity: "todos", account: "todos", categoryIds: [] },
  );
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selected, setSelected] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [nombres, setNombres] = useState<Record<string, string>>(productNames);
  const [urls, setUrls] = useState<Record<string, string>>(imageUrls);

  const [vista, setVista] = useState<"escritorio" | "movil">("escritorio");
  const [html, setHtml] = useState<string>("");
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [renderizando, startRender] = useTransition();

  const [conteo, setConteo] = useState<number | null>(null);
  const [contando, startConteo] = useTransition();

  const [state, action] = useActionState(saveCampaign, null);
  const [prueba, setPrueba] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pickerPara, setPickerPara] = useState<string | null>(null);

  // ── Vista previa en vivo: 400 ms después del último cambio ──
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startRender(async () => {
        const r = await previewCampaign({ subject, preheader, blocks, segment });
        setHtml(r.html);
        setFaltantes(r.missing);
      });
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [subject, preheader, blocks, segment]);

  useEffect(() => {
    startConteo(async () => setConteo(await estimateAudience(segment)));
  }, [segment]);

  // Tras guardar una campaña NUEVA, el constructor se queda abierto sobre ella:
  // así "Enviar prueba" aparece sin tener que volver a entrar.
  useEffect(() => {
    if (state?.ok && state.id && !campaign) router.replace(`/admin/campanas/editor?id=${state.id}`);
  }, [state, campaign, router]);

  // ── Bloques ──
  const actualizar = (id: string, cambio: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...cambio } as Block) : b)));
  const mover = (id: string, delta: -1 | 1) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const copia = [...bs];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  const quitar = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
  };
  const añadir = (type: BlockType) => {
    if (blocks.length >= MAX_BLOCKS) return;
    const b = newBlock(type);
    setBlocks((bs) => [...bs, b]);
    setSelected(b.id);
  };

  const campo = (n: string) => (state && !state.ok && state.field === n ? state.error : null);
  const anchoPrevia = vista === "escritorio" ? 640 : 390;

  return (
    <div className="flex min-h-0 flex-1">
      {/* ══════════ Izquierda: qué lleva el correo ══════════ */}
      <form action={action} className="flex w-[440px] shrink-0 flex-col border-r border-[#eee9e2] bg-white">
        {campaign && <input type="hidden" name="id" value={campaign.id} />}
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <input type="hidden" name="country" value={segment.country} />
        <input type="hidden" name="activity" value={segment.activity} />
        <input type="hidden" name="account" value={segment.account} />
        <input type="hidden" name="categoryIds" value={segment.categoryIds.join(",")} />

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {state && !state.ok && (
            <p role="alert" className="mb-4 rounded-[10px] bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p className="mb-4 rounded-[10px] bg-[#eefaf0] px-3.5 py-2.5 text-[13px] text-[#1f6b34]">
              Guardado.
            </p>
          )}

          {/* ── Correo ── */}
          <Seccion titulo="Correo">
            <div className="mb-3">
              <label className={labelCls} htmlFor="name">Nombre interno</label>
              <input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)}
                className={inputCls} placeholder="Ej. Promo agosto — tecnología" />
              {campo("name") && <Error>{campo("name")}</Error>}
            </div>
            <div className="mb-3">
              <label className={labelCls} htmlFor="subject">Asunto <Suave>({subject.length}/{MAX_ASUNTO})</Suave></label>
              <input id="subject" name="subject" maxLength={MAX_ASUNTO} value={subject}
                onChange={(e) => setSubject(e.target.value)} className={inputCls} />
              {campo("subject") && <Error>{campo("subject")}</Error>}
            </div>
            <div>
              <label className={labelCls} htmlFor="preheader">
                Preheader <Suave>({preheader.length}/{MAX_PREHEADER}) · se ve junto al asunto en la bandeja</Suave>
              </label>
              <input id="preheader" name="preheader" maxLength={MAX_PREHEADER} value={preheader}
                onChange={(e) => setPreheader(e.target.value)} className={inputCls} />
            </div>
          </Seccion>

          {/* ── Bloques ── */}
          <Seccion titulo="Contenido" nota={`${blocks.length}/${MAX_BLOCKS} bloques`}>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {BLOCK_TYPES.map((t) => {
                const Icono = ICONO[t];
                return (
                  <button key={t} type="button" onClick={() => añadir(t)}
                    disabled={blocks.length >= MAX_BLOCKS}
                    className="flex flex-col items-center gap-1.5 rounded-[12px] border-[1.6px] border-dashed border-[#e2ddd6] px-2 py-3 text-[11.5px] font-semibold text-[#6b6f78] transition-colors hover:border-kora-coral hover:text-kora-coral disabled:opacity-40">
                    <Icono className="size-[18px]" />
                    {BLOCK_LABEL[t]}
                  </button>
                );
              })}
            </div>
            {campo("blocks") && <Error>{campo("blocks")}</Error>}

            {blocks.length === 0 && (
              <p className="rounded-[10px] bg-[#faf8f5] px-3.5 py-3 text-center text-[12.5px] text-muted-foreground">
                Añade un bloque para empezar. La cabecera y el pie legal van siempre.
              </p>
            )}

            <ol className="space-y-2">
              {blocks.map((b, i) => {
                const Icono = ICONO[b.type];
                const abierto = selected === b.id;
                return (
                  <li key={b.id} className={`rounded-[12px] border-[1.6px] ${abierto ? "border-kora-coral" : "border-[#eee9e2]"}`}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button type="button" onClick={() => setSelected(abierto ? null : b.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <Icono className="size-4 shrink-0 text-[#8a8f98]" />
                        <span className="truncate text-[13px] font-semibold text-kora-black">
                          {resumen(b, nombres)}
                        </span>
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
                          onPickProduct={() => setPickerPara(b.id)}
                          onUploaded={(key, url) => {
                            setUrls((u) => ({ ...u, [key]: url }));
                            actualizar(b.id, { imageKey: key } as Partial<Block>);
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </Seccion>

          {/* ── Audiencia ── */}
          <Seccion titulo="Audiencia">
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>País</label>
                <select value={segment.country} className={inputCls}
                  onChange={(e) => setSegment({ ...segment, country: e.target.value as Segment["country"] })}>
                  <option value="ambos">Colombia y EE.UU.</option>
                  <option value="CO">Colombia</option>
                  <option value="US">Estados Unidos</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Actividad</label>
                <select value={segment.activity} className={inputCls}
                  onChange={(e) => setSegment({ ...segment, activity: e.target.value as Segment["activity"] })}>
                  {ACTIVIDAD.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Cuenta</label>
                <select value={segment.account} className={inputCls}
                  onChange={(e) => setSegment({ ...segment, account: e.target.value as Segment["account"] })}>
                  <option value="todos">Todos</option>
                  <option value="con_cuenta">Con cuenta</option>
                  <option value="invitados">Invitados</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className={labelCls}>Categorías compradas (opcional)</label>
              <div className="flex flex-wrap gap-1.5">
                {categorias.map((c) => {
                  const activa = segment.categoryIds.includes(c.id);
                  return (
                    <button key={c.id} type="button"
                      onClick={() => setSegment((s) => ({ ...s, categoryIds: activa ? s.categoryIds.filter((x) => x !== c.id) : [...s.categoryIds, c.id] }))}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${activa ? "border-kora-coral bg-kora-coral/10 text-kora-coral" : "border-[#e2ddd6] text-[#6b6f78]"}`}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {segment.country === "ambos" && (
              <p className="mb-3 rounded-[10px] bg-[#f5f3f0] px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
                Con audiencia de los dos países, los productos se muestran <strong>sin precio</strong>.
                Elige un solo país si quieres mostrar precios.
              </p>
            )}
            <div className="flex items-center gap-2 rounded-[10px] border border-[#ffd9c7] bg-[#FFF4EF] px-4 py-3">
              <Users className="size-5 text-kora-coral" />
              <span className="text-[13.5px] text-kora-black">
                {contando || conteo === null ? "Calculando destinatarios…" : (
                  <><strong>{conteo}</strong> destinatario{conteo === 1 ? "" : "s"} con estos filtros <span className="text-muted-foreground">(estimado)</span></>
                )}
              </span>
            </div>
          </Seccion>

          {/* ── Prueba ── */}
          {campaign && (
            <Seccion titulo="Enviar una prueba">
              <div className="flex gap-2">
                <input value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="tu@correo.com" className={inputCls} />
                <Button type="button" variant="outline" size="sm" disabled={!prueba.includes("@")}
                  onClick={async () => {
                    const r = await sendTestEmail(campaign.id, prueba);
                    setAviso(r.ok ? (r.message ?? "Enviado.") : r.error);
                  }}>
                  <Send className="size-3.5" /> Probar
                </Button>
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Sale con lo último <strong>guardado</strong>. No cuenta como envío de campaña ni afecta sus métricas.
              </p>
              {aviso && <p className="mt-1.5 text-[12px] text-kora-black">{aviso}</p>}
            </Seccion>
          )}
        </div>

        <div className="border-t border-[#eee9e2] bg-white px-5 py-4">
          <Button type="submit" variant="brand" className="w-full">
            {campaign ? "Guardar cambios" : "Guardar borrador"}
          </Button>
        </div>
      </form>

      {/* ══════════ Derecha: el correo tal como saldrá ══════════ */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f3efe9] [background-image:radial-gradient(#dcd5cb_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          <p className="text-[12.5px] text-muted-foreground">
            {renderizando ? "Actualizando…" : "Vista previa · es el mismo correo que se envía"}
            {faltantes.length > 0 && (
              <span className="ml-2 text-kora-coral">
                {faltantes.length} producto{faltantes.length === 1 ? "" : "s"} ya no está{faltantes.length === 1 ? "" : "n"} en el catálogo
              </span>
            )}
          </p>
          <div className="flex overflow-hidden rounded-[10px] border border-[#e2ddd6] bg-white">
            <VistaBtn activa={vista === "escritorio"} onClick={() => setVista("escritorio")} label="Escritorio"><Monitor className="size-4" /></VistaBtn>
            <VistaBtn activa={vista === "movil"} onClick={() => setVista("movil")} label="Móvil"><Smartphone className="size-4" /></VistaBtn>
          </div>
        </div>
        <div className="flex flex-1 justify-center overflow-auto px-6 pb-8">
          {/* iframe y no div: el correo lleva su propio <style> y sus tablas;
              dentro del panel heredaría Tailwind y no se vería como en la
              bandeja. */}
          <iframe
            title="Vista previa del correo"
            srcDoc={html || "<html><body style='font-family:sans-serif;color:#8a8f98;padding:40px;text-align:center'>Añade un bloque para ver el correo.</body></html>"}
            style={{ width: anchoPrevia }}
            className="h-[calc(100vh-180px)] shrink-0 rounded-[14px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-[width]"
          />
        </div>
      </div>

      {pickerPara && (
        <ProductPicker
          title="Añadir producto al correo"
          excludeIds={(blocks.find((b) => b.id === pickerPara) as Extract<Block, { type: "products" }> | undefined)?.productIds ?? []}
          onClose={() => setPickerPara(null)}
          onPick={(p) => {
            setNombres((n) => ({ ...n, [p.id]: p.name }));
            setBlocks((bs) =>
              bs.map((b) =>
                b.id === pickerPara && b.type === "products" && b.productIds.length < MAX_PRODUCTOS
                  ? { ...b, productIds: [...b.productIds, p.id] }
                  : b,
              ),
            );
            setPickerPara(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function EditorDeBloque({
  block,
  nombres,
  urls,
  onChange,
  onPickProduct,
  onUploaded,
}: {
  block: Block;
  nombres: Record<string, string>;
  urls: Record<string, string>;
  onChange: (c: Partial<Block>) => void;
  onPickProduct: () => void;
  onUploaded: (key: string, url: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

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
            // Miniatura de una imagen recién subida: `next/image` la re-optimizaría
            // desde una dirección que en pruebas es del propio VPS. La real la sirve el correo.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="mb-2 max-h-40 w-full rounded-[10px] object-cover" />
          ) : (
            <p className="mb-2 text-[12px] text-muted-foreground">JPG, PNG o WebP hasta 5 MB. Se guarda a 1200 px de ancho.</p>
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
          {errorSubida && <Error>{errorSubida}</Error>}
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
          <Button type="button" variant="outline" size="sm" onClick={onPickProduct} disabled={block.productIds.length >= MAX_PRODUCTOS}>
            <Package className="size-3.5" /> Añadir producto ({block.productIds.length}/{MAX_PRODUCTOS})
          </Button>
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

function resumen(b: Block, nombres: Record<string, string>): string {
  switch (b.type) {
    case "title":
      return b.text.trim() || "Título (vacío)";
    case "text":
      return b.text.trim().split("\n")[0]?.slice(0, 60) || "Texto (vacío)";
    case "image":
      return b.imageKey ? "Imagen" : "Imagen (sin subir)";
    case "button":
      return b.label.trim() ? `Botón: ${b.label.trim()}` : "Botón";
    case "products":
      return b.productIds.length === 0
        ? "Productos (ninguno)"
        : b.productIds.map((id) => nombres[id] ?? "…").join(", ");
    case "divider":
      return "Separador";
    case "spacer":
      return `Espacio ${b.height === 16 ? "pequeño" : b.height === 32 ? "medio" : "grande"}`;
  }
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</h3>
        {nota && <span className="text-[11.5px] text-muted-foreground">{nota}</span>}
      </div>
      {children}
    </section>
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

function VistaBtn({ activa, onClick, label, children }: { activa: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={activa}
      className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold ${activa ? "bg-kora-black text-white" : "text-[#6b6f78] hover:bg-[#faf8f5]"}`}>
      {children}
    </button>
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[12px] text-destructive">{children}</p>;
}
function Suave({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-[#9aa0ab]">{children}</span>;
}
