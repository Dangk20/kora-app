"use client";

// El constructor de campañas, paso a paso. Igual que el alta de producto:
// primero QUÉ y A QUIÉN, después CÓMO SE VE, y al final se revisa y se decide.
// Llevar de la mano en vez de enseñarlo todo a la vez es la experiencia del
// panel entero, y aquí importa más: una campaña le escribe a toda la base.
//
// Guardado: al pasar del diseño a la revisión se guarda el borrador, para que
// el último paso tenga una campaña real sobre la que enviar o programar. En
// una campaña nueva eso crea el registro y el constructor se queda abierto
// sobre ella (con su id en la dirección).

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LayoutTemplate, Save, SendHorizonal, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estimateAudience, previewCampaign, saveCampaign } from "@/modules/campaigns/actions";
import { validateBlocks, type Block } from "@/modules/campaigns/blocks";
import { MAX_ASUNTO, type Segment } from "@/modules/campaigns/types";
import { PasoCampana, type DatosCampana } from "./paso-campana";
import { PasoDiseno } from "./paso-diseno";
import { PasoRevisar } from "./paso-revisar";

const PASOS = [
  { titulo: "La campaña", ayuda: "Nombre, asunto y a quién va.", Icono: Settings2 },
  { titulo: "El diseño", ayuda: "Bloques, con el correo a la vista.", Icono: LayoutTemplate },
  { titulo: "Revisar y enviar", ayuda: "Prueba, confirma y decide.", Icono: SendHorizonal },
] as const;

export function Builder({
  campaign,
  initialBlocks,
  initialStep,
  productNames,
  imageUrls,
  categorias,
}: {
  campaign: { id: string; name: string; subject: string; preheader: string; segment: Segment } | null;
  initialBlocks: Block[];
  initialStep: number;
  productNames: Record<string, string>;
  imageUrls: Record<string, string>;
  categorias: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(Math.min(Math.max(initialStep, 0), campaign ? 2 : 1));

  const [datos, setDatos] = useState<DatosCampana>({
    name: campaign?.name ?? "",
    subject: campaign?.subject ?? "",
    preheader: campaign?.preheader ?? "",
  });
  const [segment, setSegment] = useState<Segment>(
    campaign?.segment ?? { country: "ambos", activity: "todos", account: "todos", categoryIds: [] },
  );
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [nombres, setNombres] = useState(productNames);
  const [urls, setUrls] = useState(imageUrls);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  // ── Audiencia y vista previa, en vivo ──
  const [conteo, setConteo] = useState<number | null>(null);
  const [contando, startConteo] = useTransition();
  useEffect(() => {
    startConteo(async () => setConteo(await estimateAudience(segment)));
  }, [segment]);

  const [html, setHtml] = useState("");
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [renderizando, startRender] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (paso === 0) return; // en el paso 1 no hay nada que dibujar todavía
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startRender(async () => {
        const r = await previewCampaign({ subject: datos.subject, preheader: datos.preheader, blocks, segment });
        setHtml(r.html);
        setFaltantes(r.missing);
      });
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [paso, datos.subject, datos.preheader, blocks, segment]);

  // ── Validación por paso: lo mínimo para poder seguir ──
  const validarPaso1 = (): boolean => {
    const e: Record<string, string> = {};
    if (datos.name.trim().length < 3) e.name = "Ponle un nombre a la campaña.";
    if (!datos.subject.trim()) e.subject = "El asunto es obligatorio.";
    else if (datos.subject.length > MAX_ASUNTO) e.subject = `El asunto no puede pasar de ${MAX_ASUNTO} caracteres.`;
    setErrores(e);
    return Object.keys(e).length === 0;
  };
  const validarPaso2 = (): boolean => {
    const p = validateBlocks(blocks);
    setErrorGuardar(p[0]?.message ?? null);
    return p.length === 0;
  };

  /** Guarda el borrador. Devuelve el id (nuevo o el mismo) o null si falló. */
  const guardar = (): Promise<string | null> =>
    new Promise((resolve) => {
      startGuardar(async () => {
        const fd = new FormData();
        if (campaign) fd.set("id", campaign.id);
        fd.set("name", datos.name);
        fd.set("subject", datos.subject);
        fd.set("preheader", datos.preheader);
        fd.set("blocks", JSON.stringify(blocks));
        fd.set("country", segment.country);
        fd.set("activity", segment.activity);
        fd.set("account", segment.account);
        fd.set("categoryIds", segment.categoryIds.join(","));
        const r = await saveCampaign(null, fd);
        if (!r.ok) {
          setErrorGuardar(r.error);
          resolve(null);
          return;
        }
        setErrorGuardar(null);
        resolve(r.id ?? campaign?.id ?? null);
      });
    });

  const continuar = async () => {
    if (paso === 0) {
      if (validarPaso1()) setPaso(1);
      return;
    }
    if (paso === 1) {
      if (!validarPaso2()) return;
      const id = await guardar();
      if (!id) return;
      if (!campaign) {
        // Campaña nueva: ahora existe. El constructor se queda abierto sobre
        // ella, en el último paso.
        router.replace(`/admin/campanas/editor?id=${id}&paso=3`);
        return;
      }
      setPaso(2);
    }
  };

  const ir = (i: number) => {
    // Hacia atrás siempre; hacia adelante solo por "Continuar", que valida.
    if (i < paso) setPaso(i);
    else if (i === paso + 1) void continuar();
  };

  // Las mismas acciones arriba y abajo: en el paso de diseño la columna
  // izquierda es larga, y obligar a bajar hasta el pie para seguir es
  // justo lo que no hace "llevar de la mano".
  const acciones = (
    <div className="flex items-center gap-2">
      {paso > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setPaso(paso - 1)}>
          <ArrowLeft className="size-4" /> Atrás
        </Button>
      )}
      {paso >= 1 && (
        // "Guardar borrador" es guardar Y SALIR al módulo, como cerrar el
        // alta de producto: para seguir trabajando está "Continuar". Guardar
        // y quedarse aquí dejaba al operador sin saber si ya podía irse.
        <Button type="button" variant="outline" size="sm" disabled={guardando}
          onClick={async () => {
            if (!validarPaso2()) return;
            const id = await guardar();
            if (id) router.push("/admin/campanas");
          }}>
          <Save className="size-4" /> {guardando ? "Guardando…" : "Guardar borrador"}
        </Button>
      )}
      {paso < 2 && (
        <Button type="button" variant="brand" size="sm" disabled={guardando} onClick={() => void continuar()}>
          {paso === 1 ? (guardando ? "Guardando…" : "Guardar y revisar") : "Continuar"} <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PasosCabecera paso={paso} onIr={ir} acciones={acciones} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {paso === 0 && (
          <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
            <PasoCampana
              datos={datos} onDatos={setDatos}
              segment={segment} onSegment={setSegment}
              categorias={categorias} conteo={conteo} contando={contando} errores={errores}
            />
          </div>
        )}
        {paso === 1 && (
          <PasoDiseno
            blocks={blocks} onBlocks={setBlocks}
            nombres={nombres} onNombres={setNombres}
            urls={urls} onUrls={setUrls}
            html={html} renderizando={renderizando} faltantes={faltantes}
            error={errorGuardar}
          />
        )}
        {paso === 2 && campaign && (
          <PasoRevisar campaignId={campaign.id} datos={datos} segment={segment} categorias={categorias} conteo={conteo} html={html} />
        )}
      </div>

      {/* ── Pie: las mismas acciones que arriba ── */}
      <div className="flex items-center justify-end border-t border-[#eee9e2] bg-white px-6 py-3">
        {acciones}
      </div>
    </div>
  );
}

/** La barra de pasos. Siempre visible: saber dónde se está evita abandonar. */
function PasosCabecera({ paso, onIr, acciones }: { paso: number; onIr: (i: number) => void; acciones: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6 border-b border-[#f0ece6] bg-[#faf8f5] px-6 py-3">
      <div className="flex min-w-0 flex-1 items-stretch gap-2">
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
              // `min-w-0`: sin él `flex-1` no reparte por igual (misma trampa
              // que el alta de producto).
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                actual ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "hover:bg-white/70"
              }`}
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] ${
                actual ? "bg-kora-gradient text-white" : hecho ? "bg-[#FFE9DD] text-kora-coral" : "bg-[#f0ece6] text-[#b3b8c0]"
              }`}>
                {hecho ? <Check className="size-[18px]" /> : <Icono className="size-[18px]" />}
              </span>
              <div className="min-w-0">
                <p className={`truncate text-[13px] font-bold ${actual || hecho ? "text-kora-black" : "text-[#b3b8c0]"}`}>
                  {i + 1}. {p.titulo}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground">{p.ayuda}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="shrink-0">{acciones}</div>
    </div>
  );
}
