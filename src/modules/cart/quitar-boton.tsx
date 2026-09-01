"use client";

// El botón de quitar del carrito, CON su confirmación dentro.
//
// Un solo componente para los dos sitios donde se puede quitar algo —el panel
// lateral y la página del carrito— porque lo que no puede divergir es el
// texto de la pregunta y, sobre todo, cuál de las dos respuestas es la fácil.
// Con la confirmación escrita dos veces, basta que alguien toque una para que
// la tienda pregunte distinto según dónde estés.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QuitarDelCarrito({
  nombre,
  variante,
  onQuitar,
  className,
}: {
  nombre: string;
  /** Talla, color… lo que distingue esta línea de otra del mismo producto. */
  variante?: string | null;
  onQuitar: () => void;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Quitar ${nombre} del carrito`}
        className={className}
      >
        <Trash2 className="size-4" />
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        {/* Más lenta que el diálogo del panel (100 ms) y con la curva de la
            tienda: una confirmación que aparece de golpe se contesta de golpe,
            que es justo lo contrario de lo que se le pide a una confirmación. */}
        <DialogContent
          // z-[80]: el panel lateral del carrito vive en z-[60]. Sin esto la
          // ventana queda por debajo y el panel es lo único de la pantalla que
          // no se atenúa — precisamente donde está el producto por el que se
          // pregunta.
          overlayClassName="z-[80] bg-[rgba(14,15,18,0.45)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          className="z-[90] rounded-2xl border-none p-0 shadow-[0_28px_60px_-18px_rgba(22,24,29,0.35)] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[380px] motion-reduce:duration-0"
        >
          <div className="px-6 pt-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[17px] font-bold text-kora-black">
                ¿Quitar este producto?
              </DialogTitle>
              <DialogDescription className="text-[13.5px] leading-relaxed text-[#6b7280]">
                <span className="font-semibold text-kora-black">{nombre}</span>
                {variante ? ` · ${variante}` : ""} saldrá de tu carrito. Puedes
                volver a agregarlo cuando quieras.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* El orden y el peso NO son estéticos: la salida sin consecuencias
              va primera y es la que se ve; quitar es un enlace discreto. Quien
              abre esta ventana por accidente —un pulgar en el móvil, un clic de
              más— tiene delante el botón que no rompe nada. */}
          <div className="flex flex-col gap-2 px-6 pt-5 pb-6">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-full rounded-full bg-kora-black px-6 py-3.5 text-[14.5px] font-bold text-white transition-colors hover:bg-kora-gray-dark"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                onQuitar();
              }}
              className="w-full rounded-full px-6 py-2.5 text-[13.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              Sí, quitarlo del carrito
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
