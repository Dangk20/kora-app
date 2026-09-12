"use client";

// Paso 1: los datos de la campaña y a quién va. Sin diseño todavía: primero
// se decide qué se dice y a quién, y solo después cómo se ve.

import { Users } from "lucide-react";
import { MAX_ASUNTO, MAX_PREHEADER, type Segment } from "@/modules/campaigns/types";
import { ACTIVIDAD, ErrorTexto, Seccion, Suave, inputCls, labelCls } from "./ui";

export type DatosCampana = { name: string; subject: string; preheader: string };

export function PasoCampana({
  datos,
  onDatos,
  segment,
  onSegment,
  categorias,
  conteo,
  contando,
  errores,
}: {
  datos: DatosCampana;
  onDatos: (d: DatosCampana) => void;
  segment: Segment;
  onSegment: (s: Segment) => void;
  categorias: { id: string; name: string }[];
  conteo: number | null;
  contando: boolean;
  errores: Record<string, string>;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Seccion titulo="La campaña">
        <div className="mb-3">
          <label className={labelCls} htmlFor="name">Nombre interno <Suave>· solo lo ve el panel</Suave></label>
          <input id="name" value={datos.name} onChange={(e) => onDatos({ ...datos, name: e.target.value })}
            className={inputCls} placeholder="Ej. Promo agosto — tecnología" autoFocus />
          {errores.name && <ErrorTexto>{errores.name}</ErrorTexto>}
        </div>
        <div className="mb-3">
          <label className={labelCls} htmlFor="subject">Asunto <Suave>({datos.subject.length}/{MAX_ASUNTO})</Suave></label>
          <input id="subject" maxLength={MAX_ASUNTO} value={datos.subject}
            onChange={(e) => onDatos({ ...datos, subject: e.target.value })} className={inputCls}
            placeholder="Lo primero que se lee en la bandeja" />
          {errores.subject && <ErrorTexto>{errores.subject}</ErrorTexto>}
        </div>
        <div>
          <label className={labelCls} htmlFor="preheader">
            Preheader <Suave>({datos.preheader.length}/{MAX_PREHEADER}) · se ve junto al asunto, decide si se abre</Suave>
          </label>
          <input id="preheader" maxLength={MAX_PREHEADER} value={datos.preheader}
            onChange={(e) => onDatos({ ...datos, preheader: e.target.value })} className={inputCls} />
        </div>
      </Seccion>

      <Seccion titulo="A quién va">
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>País</label>
            <select value={segment.country} className={inputCls}
              onChange={(e) => onSegment({ ...segment, country: e.target.value as Segment["country"] })}>
              <option value="ambos">Colombia y EE.UU.</option>
              <option value="CO">Colombia</option>
              <option value="US">Estados Unidos</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Actividad</label>
            <select value={segment.activity} className={inputCls}
              onChange={(e) => onSegment({ ...segment, activity: e.target.value as Segment["activity"] })}>
              {ACTIVIDAD.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cuenta</label>
            <select value={segment.account} className={inputCls}
              onChange={(e) => onSegment({ ...segment, account: e.target.value as Segment["account"] })}>
              <option value="todos">Todos</option>
              <option value="con_cuenta">Con cuenta</option>
              <option value="invitados">Invitados</option>
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className={labelCls}>Categorías compradas <Suave>(opcional)</Suave></label>
          <div className="flex flex-wrap gap-1.5">
            {categorias.map((c) => {
              const activa = segment.categoryIds.includes(c.id);
              return (
                <button key={c.id} type="button"
                  onClick={() => onSegment({ ...segment, categoryIds: activa ? segment.categoryIds.filter((x) => x !== c.id) : [...segment.categoryIds, c.id] })}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${activa ? "border-kora-coral bg-kora-coral/10 text-kora-coral" : "border-[#e2ddd6] text-[#6b6f78]"}`}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        {segment.country === "ambos" && (
          <p className="mb-3 rounded-[10px] bg-[#f5f3f0] px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            Con audiencia de los dos países, los productos se muestran <strong>sin precio</strong>: no
            existe tasa de cambio. Elige un solo país si quieres mostrar precios.
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
    </div>
  );
}
