"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Printer } from "lucide-react";
import { cambiarEstadoRuleta, guardarPremiosRuleta } from "@/modules/ruleta/actions";

export function EstadoRuleta({ activa, puedeEditar }: { activa: boolean; puedeEditar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <span
        className={`rounded-full px-3 py-1 text-[13px] font-bold ${
          activa ? "bg-[#e8f6ec] text-[#1f7a3d]" : "bg-[#f4f2ef] text-[#8a8f98]"
        }`}
      >
        {activa ? "Abierta" : "Cerrada"}
      </span>
      {puedeEditar && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              await cambiarEstadoRuleta(!activa);
              router.refresh();
            })
          }
          className="inline-flex items-center gap-2 rounded-full bg-kora-black px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {activa ? <Pause className="size-4" /> : <Play className="size-4" />}
          {activa ? "Cerrar ruleta" : "Abrir ruleta"}
        </button>
      )}
    </div>
  );
}

/** Abre una hoja con el cartel del QR lista para imprimir. */
export function ImprimirQr({ qr }: { qr: string }) {
  function imprimir() {
    const w = window.open("", "_blank", "width=640,height=860");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ruleta KORA</title>
<style>
  body{font-family:Manrope,Arial,sans-serif;text-align:center;margin:0;padding:48px 32px;color:#121212}
  .barra{height:10px;border-radius:99px;background:linear-gradient(90deg,#ff6a00,#f2357e 50%,#7a3db8);margin-bottom:36px}
  h1{font-size:46px;margin:0;font-weight:900}
  p{font-size:20px;margin:10px 0 28px}
  .qr{width:340px;margin:0 auto}
  .pie{margin-top:26px;font-size:17px;font-weight:700;color:#ff5a1f}
</style></head><body>
<div class="barra"></div>
<h1>¡Gira y gana!</h1>
<p>Escanea, crea tu cuenta KORA y gira la ruleta.<br>Todos ganan.</p>
<div class="qr">${qr}</div>
<div class="pie">Un giro por persona · Premios válidos por 30 días</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`);
    w.document.close();
  }
  return (
    <button
      type="button"
      onClick={imprimir}
      className="mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold"
    >
      <Printer className="size-4" /> Imprimir cartel
    </button>
  );
}

type Fila = {
  key: string;
  titulo: string;
  peso: number;
  tope: number | null;
  probabilidad: number;
  ganados: number;
  usados: number;
  /** undefined = no es un producto; null = el SKU no existe en esta base. */
  stock: number | null | undefined;
  /** Slugs de las categorías del premio que esta tienda no tiene. */
  faltan: string[];
  todas: number;
};

export function PremiosForm({ filas, puedeEditar }: { filas: Fila[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  return (
    <form
      action={(fd) =>
        iniciar(async () => {
          const r = await guardarPremiosRuleta(fd);
          setMensaje(r.ok ? { ok: true, texto: "Premios guardados" } : { ok: false, texto: r.error });
          if (r.ok) router.refresh();
        })
      }
      className="overflow-hidden rounded-2xl border bg-white"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#faf7f3] text-left text-[12px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Premio</th>
              <th className="px-3 py-3">Peso</th>
              <th className="px-3 py-3">Sale</th>
              <th className="px-3 py-3">Tope</th>
              <th className="px-3 py-3">Ganados</th>
              <th className="px-3 py-3">Usados</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const agotado = f.tope !== null && f.ganados >= f.tope;
              return (
                <tr key={f.key} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-kora-black">{f.titulo}</div>
                    {f.stock !== undefined && (
                      <div className={`text-[12px] ${f.stock ? "text-muted-foreground" : "text-[#b42318]"}`}>
                        {f.stock === null
                          ? "El producto no existe en esta tienda: no sale"
                          : f.stock > 0
                            ? `${f.stock} en inventario`
                            : "Sin inventario: no sale"}
                      </div>
                    )}
                    {f.faltan.length > 0 && (
                      <div className="text-[12px] text-[#b42318]">
                        {f.faltan.length === f.todas
                          ? "La categoría no existe en esta tienda: no sale"
                          : `No existen: ${f.faltan.join(", ")}`}
                      </div>
                    )}
                    {agotado && <div className="text-[12px] text-[#b25a12]">Tope alcanzado: ya no sale</div>}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      name={`peso-${f.key}`}
                      defaultValue={f.peso}
                      inputMode="numeric"
                      disabled={!puedeEditar}
                      className="h-9 w-16 rounded-lg border px-2"
                    />
                  </td>
                  <td className="px-3 py-3 font-semibold">{f.probabilidad.toFixed(0)}%</td>
                  <td className="px-3 py-3">
                    <input
                      name={`tope-${f.key}`}
                      defaultValue={f.tope ?? ""}
                      placeholder="Sin tope"
                      inputMode="numeric"
                      disabled={!puedeEditar}
                      className="h-9 w-20 rounded-lg border px-2"
                    />
                  </td>
                  <td className="px-3 py-3">{f.ganados}</td>
                  <td className="px-3 py-3">{f.usados}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {puedeEditar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-[#faf7f3] px-4 py-3">
          <p className="text-[12px] text-muted-foreground">
            &quot;Sale&quot; es la probabilidad de cada premio: su peso sobre la suma de todos.
          </p>
          <div className="flex items-center gap-3">
            {mensaje && (
              <span className={`text-[13px] ${mensaje.ok ? "text-[#1f7a3d]" : "text-[#b42318]"}`}>{mensaje.texto}</span>
            )}
            <button
              type="submit"
              disabled={pendiente}
              className="rounded-full bg-[#ff5a1f] px-5 py-2 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {pendiente ? "Guardando…" : "Guardar premios"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
