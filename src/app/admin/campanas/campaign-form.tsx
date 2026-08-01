"use client";

// Crear o editar una campaña. Slide-over controlado por la dirección, como el
// resto del panel (?nueva=1, ?editar=id).
//
// El conteo de destinatarios se recalcula cada vez que cambia un filtro: es el
// ÚNICO freno que tiene el operador antes de escribirle a toda la base, y sin
// él la diferencia entre segmentar y hacer spam no se ve hasta después.

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Send, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estimateAudience, saveCampaign, sendTestEmail } from "@/modules/campaigns/actions";
// Tipos y topes desde `types.ts`, que no importa nada: traerlos de `audience`
// o `content` metería Prisma y `node:fs` en el paquete del navegador.
import {
  MAX_ASUNTO,
  MAX_PREHEADER,
  MAX_PRODUCTOS,
  SEGMENTO_VACIO,
  type Segment,
} from "@/modules/campaigns/types";

type Opcion = { id: string; name: string };

export type CampaignDraft = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  productIds: string[];
  segment: Segment;
};

const inputCls =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 text-[13.5px] outline-none focus:border-kora-coral";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

const ACTIVIDAD: { value: Segment["activity"]; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activos_30", label: "Compraron en 30 días" },
  { value: "activos_60", label: "Compraron en 60 días" },
  { value: "activos_90", label: "Compraron en 90 días" },
  { value: "inactivos_90", label: "Sin comprar hace +90 días" },
  { value: "sin_compras", label: "Nunca han comprado" },
];

export function CampaignForm({
  campaign,
  categorias,
  productos,
  backTo,
}: {
  campaign: CampaignDraft | null;
  categorias: Opcion[];
  productos: Opcion[];
  backTo: string;
}) {
  const router = useRouter();
  const cerrar = () => router.push(backTo);

  const [state, action] = useActionState(saveCampaign, null);
  const [segment, setSegment] = useState<Segment>(campaign?.segment ?? SEGMENTO_VACIO);
  const [productIds, setProductIds] = useState<string[]>(campaign?.productIds ?? []);
  const [conteo, setConteo] = useState<number | null>(null);
  const [contando, startConteo] = useTransition();
  const [previa, setPrevia] = useState(false);
  const [prueba, setPrueba] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  // Conteo en vivo: cada cambio de filtro lo recalcula en servidor.
  useEffect(() => {
    startConteo(async () => setConteo(await estimateAudience(segment)));
  }, [segment]);

  useEffect(() => {
    if (state?.ok) router.push(backTo);
  }, [state, router, backTo]);

  const alternarProducto = (id: string) =>
    setProductIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_PRODUCTOS ? [...p, id] : p,
    );

  const alternarCategoria = (id: string) =>
    setSegment((s) => ({
      ...s,
      categoryIds: s.categoryIds.includes(id)
        ? s.categoryIds.filter((x) => x !== id)
        : [...s.categoryIds, id],
    }));

  const campo = (name: string) => (state && !state.ok && state.field === name ? state.error : null);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(14,15,18,0.5)]" onClick={cerrar}>
      <div
        className="flex h-full w-[620px] max-w-full flex-col overflow-y-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0ece6] bg-white px-6 py-5">
          <h2 className="text-[17px] font-extrabold text-kora-black">
            {campaign ? "Editar campaña" : "Crear campaña"}
          </h2>
          <button onClick={cerrar} aria-label="Cerrar" className="text-[#8a8f98]">
            <X className="size-5" />
          </button>
        </div>

        <form action={action} className="flex-1 px-6 py-5">
          {campaign && <input type="hidden" name="id" value={campaign.id} />}
          <input type="hidden" name="productIds" value={productIds.join(",")} />
          <input type="hidden" name="country" value={segment.country} />
          <input type="hidden" name="activity" value={segment.activity} />
          <input type="hidden" name="account" value={segment.account} />
          <input type="hidden" name="categoryIds" value={segment.categoryIds.join(",")} />

          {state && !state.ok && !state.field && (
            <p role="alert" className="mb-4 rounded-[10px] bg-[#fdf2f2] px-3.5 py-2.5 text-[13px] text-[#8a2020]">
              {state.error}
            </p>
          )}

          {/* ── Contenido ── */}
          <h3 className="mb-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            Contenido
          </h3>

          <div className="mb-3">
            <label className={labelCls} htmlFor="name">Nombre interno</label>
            <input id="name" name="name" defaultValue={campaign?.name} className={inputCls}
              placeholder="Ej. Promo agosto — tecnología" />
            {campo("name") && <p className="mt-1 text-[12px] text-destructive">{campo("name")}</p>}
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="subject">Asunto (máx. {MAX_ASUNTO})</label>
              <input id="subject" name="subject" maxLength={MAX_ASUNTO}
                defaultValue={campaign?.subject} className={inputCls} />
              {campo("subject") && <p className="mt-1 text-[12px] text-destructive">{campo("subject")}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="preheader">
                Preheader (máx. {MAX_PREHEADER})
              </label>
              <input id="preheader" name="preheader" maxLength={MAX_PREHEADER}
                defaultValue={campaign?.preheader} className={inputCls} />
              {/* Lo que la bandeja muestra junto al asunto: decide si se abre. */}
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Se ve junto al asunto en la bandeja.
              </p>
            </div>
          </div>

          <div className="mb-3">
            <label className={labelCls} htmlFor="title">Título del correo</label>
            <input id="title" name="title" defaultValue={campaign?.title} className={inputCls} />
            {campo("title") && <p className="mt-1 text-[12px] text-destructive">{campo("title")}</p>}
          </div>

          <div className="mb-3">
            <label className={labelCls} htmlFor="body">Texto</label>
            <textarea id="body" name="body" rows={6} defaultValue={campaign?.body}
              className={`${inputCls} resize-y`} placeholder="Separa los párrafos con una línea en blanco." />
            {campo("body") && <p className="mt-1 text-[12px] text-destructive">{campo("body")}</p>}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ctaLabel">Texto del botón</label>
              <input id="ctaLabel" name="ctaLabel" defaultValue={campaign?.ctaLabel}
                className={inputCls} placeholder="Ver la tienda" />
            </div>
            <div>
              <label className={labelCls} htmlFor="ctaUrl">Enlace del botón</label>
              <input id="ctaUrl" name="ctaUrl" defaultValue={campaign?.ctaUrl}
                className={inputCls} placeholder="https://korashopp.com/catalogo" />
              {campo("ctaUrl") && <p className="mt-1 text-[12px] text-destructive">{campo("ctaUrl")}</p>}
            </div>
          </div>

          <div className="mb-5">
            <label className={labelCls}>
              Productos destacados ({productIds.length}/{MAX_PRODUCTOS})
            </label>
            <div className="max-h-40 overflow-y-auto rounded-[10px] border border-[#e2ddd6] p-2">
              {productos.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 px-1.5 py-1 text-[13px]">
                  <input type="checkbox" checked={productIds.includes(p.id)}
                    onChange={() => alternarProducto(p.id)} className="size-3.5 accent-kora-orange" />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          {/* ── Audiencia ── */}
          <h3 className="mb-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            Audiencia
          </h3>

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
              {categorias.map((c) => (
                <button key={c.id} type="button" onClick={() => alternarCategoria(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
                    segment.categoryIds.includes(c.id)
                      ? "border-kora-coral bg-kora-coral/10 text-kora-coral"
                      : "border-[#e2ddd6] text-[#6b6f78]"
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {segment.country === "ambos" && (
            /* No existe tasa de cambio en KORA: un precio único para dos países
               le mentiría a la mitad de la lista. */
            <p className="mb-3 rounded-[10px] bg-[#f5f3f0] px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
              Con audiencia de los dos países, los productos se muestran <strong>sin precio</strong>,
              con enlace a su ficha. Elige un solo país si quieres mostrar precios.
            </p>
          )}

          <div className="mb-5 flex items-center gap-2 rounded-[10px] border border-[#ffd9c7] bg-[#FFF4EF] px-4 py-3">
            <Users className="size-5 text-kora-coral" />
            <span className="text-[13.5px] text-kora-black">
              {contando || conteo === null ? (
                "Calculando destinatarios…"
              ) : (
                <>
                  <strong>{conteo}</strong> destinatario{conteo === 1 ? "" : "s"} con estos filtros
                  <span className="ml-1 text-muted-foreground">(estimado)</span>
                </>
              )}
            </span>
          </div>

          {/* ── Prueba ── */}
          {campaign && (
            <div className="mb-5 rounded-[10px] border border-[#e2ddd6] p-4">
              <label className={labelCls}>Enviar un correo de prueba</label>
              <div className="flex gap-2">
                <input value={prueba} onChange={(e) => setPrueba(e.target.value)}
                  placeholder="tu@correo.com" className={inputCls} />
                <Button type="button" variant="outline" size="sm" disabled={!prueba.includes("@")}
                  onClick={async () => {
                    const r = await sendTestEmail(campaign.id, prueba);
                    setAviso(r.ok ? (r.message ?? "Enviado.") : r.error);
                  }}>
                  <Send className="size-3.5" /> Probar
                </Button>
              </div>
              {/* No consume audiencia ni métricas: es el único ensayo real. */}
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                No cuenta como envío ni afecta las métricas.
              </p>
              {aviso && <p className="mt-1.5 text-[12px] text-kora-black">{aviso}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" variant="brand" className="flex-1">
              {campaign ? "Guardar cambios" : "Guardar borrador"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPrevia((v) => !v)}>
              <Eye className="size-4" /> {previa ? "Ocultar" : "Vista previa"}
            </Button>
          </div>

          {previa && campaign && (
            <div className="mt-4 overflow-hidden rounded-[10px] border border-[#e2ddd6]">
              {/* La vista previa carga el MISMO render del envío. */}
              <iframe src={`/admin/campanas/${campaign.id}/previa`} title="Vista previa"
                className="h-[520px] w-full bg-white" />
            </div>
          )}
          {previa && !campaign && (
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              Guarda el borrador para ver la vista previa.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
