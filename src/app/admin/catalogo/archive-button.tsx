"use client";

// Retirar un producto del catálogo, con motivo obligatorio.
//
// Ver `archiveProduct` en `catalog/product-actions.ts` para por qué esto
// ARCHIVA en vez de borrar cuando el producto tiene historia.

import { useState, useTransition } from "react";
import { ACTION_ICON_DANGER } from "../_components/action-icon";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveProduct } from "@/modules/catalog/product-actions";

export function ArchiveButton({
  productId,
  nombre,
  stock,
  ventas,
  enCurso,
}: {
  productId: string;
  nombre: string;
  stock: number;
  /** Cuántas veces se ha vendido. Decide si se archiva o se borra. */
  ventas: number;
  /** Pedidos sin entregar. Con uno solo, no se puede retirar. */
  enCurso: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const seBorra = ventas === 0 && stock === 0;
  // Se dice ANTES de pedir el motivo: escribir tres líneas para que después
  // te digan que no se puede es el peor orden posible.
  const bloqueado = enCurso > 0;

  const confirmar = () =>
    start(async () => {
      const r = await archiveProduct(productId, motivo);
      if (r.ok) {
        setAbierto(false);
        setMotivo("");
        setError(null);
        return;
      }
      setError(r.error);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Retirar ${nombre} del catálogo`}
        title="Retirar del catálogo"
        className={ACTION_ICON_DANGER}
      >
        <Trash2 className="size-[15px]" />
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent
          overlayClassName="z-[80] bg-[rgba(14,15,18,0.45)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          className="z-[90] rounded-2xl border-none p-0 shadow-[0_28px_60px_-18px_rgba(22,24,29,0.35)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[440px] motion-reduce:duration-0"
        >
          <div className="px-6 pt-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[17px] font-bold text-kora-black">
                {bloqueado
                  ? "Todavía no se puede retirar"
                  : seBorra
                    ? "¿Eliminar este producto?"
                    : "¿Retirar este producto?"}
              </DialogTitle>
              <DialogDescription className="text-[13.5px] leading-relaxed text-[#6b7280]">
                <span className="font-semibold text-kora-black">{nombre}</span>
                {bloqueado ? (
                  <>
                    {" "}tiene{" "}
                    <span className="font-semibold text-kora-black">
                      {enCurso} {enCurso === 1 ? "pedido sin entregar" : "pedidos sin entregar"}
                    </span>
                    . Sacarlo del catálogo ahora dejaría al operador sin la ficha
                    justo cuando tiene que empacarlo, y al comprador esperando algo
                    que ya no existe. Despáchalos o cancélalos y vuelve.
                  </>
                ) : seBorra ? (
                  <> se eliminará. Nunca tuvo ventas ni movimientos de inventario, así que no hay historia que conservar.</>
                ) : (
                  <>
                    {" "}sale de la tienda y del listado, pero{" "}
                    <span className="font-semibold text-kora-black">no se borra</span>: su
                    inventario y sus ventas son parte del historial del negocio y los pedidos
                    que lo vendieron seguirían apuntando a él.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {/* Lo que tiene HOY, para que la decisión se tome con el dato
                delante y no de memoria. */}
            {!seBorra && !bloqueado && (
              <div className="mt-4 flex gap-3 rounded-[12px] bg-[#FFF4EF] px-4 py-3 text-[12.5px] text-[#6b6f78]">
                <span>
                  <span className="font-bold text-kora-black">{stock}</span> unidades en
                  inventario
                </span>
                <span className="text-[#e2ddd6]">·</span>
                <span>
                  <span className="font-bold text-kora-black">{ventas}</span> {ventas === 1 ? "venta" : "ventas"}
                </span>
              </div>
            )}

            {!bloqueado && (
            <div className="mt-4">
              <label
                htmlFor="motivo"
                className="mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]"
              >
                Motivo <span className="font-normal text-[#9aa0ab]">(queda en el historial)</span>
              </label>
              <textarea
                id="motivo"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. Descontinuado por el proveedor; no se vuelve a pedir."
                className="w-full resize-y rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral"
              />
              {error && (
                <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-destructive">
                  {error}
                </p>
              )}
            </div>
            )}
          </div>

          {/* Cancelar dominante, como en el resto del sistema. */}
          <div className="flex flex-col gap-2 px-6 pt-5 pb-6">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-full rounded-full bg-kora-black px-6 py-3.5 text-[14.5px] font-bold text-white transition-colors hover:bg-kora-gray-dark"
            >
              {bloqueado ? "Entendido" : "Cancelar"}
            </button>
            {!bloqueado && (
            <button
              type="button"
              onClick={confirmar}
              disabled={pending}
              className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              {pending
                ? "Retirando…"
                : seBorra
                  ? "Sí, eliminarlo"
                  : "Sí, retirarlo del catálogo"}
            </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
