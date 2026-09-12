"use client";

// La vista previa del correo: el HTML del envío dentro de un iframe.
//
// iframe y no div: el correo lleva su propio <style> y sus tablas; dentro del
// panel heredaría Tailwind y no se vería como en la bandeja.
//
// Claro/oscuro: el correo declara los dos esquemas y Gmail en el móvil aplica
// el oscuro por su cuenta (el 28 ago 2026 el botón salía ilegible). El iframe
// hereda el modo del sistema de quien mira, así que sin este control el
// operador con macOS en oscuro creería que el correo "sale negro". Los dos
// salen del MISMO html: claro quita la capa de modo oscuro, oscuro la fuerza.

import { useState } from "react";
import { Monitor, Moon, Smartphone, Sun } from "lucide-react";

const OSCURO = /@media\s*\(prefers-color-scheme:\s*dark\)/g;

export function Previa({ html, alto = "calc(100vh - 260px)" }: { html: string; alto?: string }) {
  const [ancho, setAncho] = useState<"escritorio" | "movil">("escritorio");
  const [modo, setModo] = useState<"claro" | "oscuro">("claro");

  const doc = !html
    ? "<html><body style='font-family:sans-serif;color:#8a8f98;padding:40px;text-align:center'>Añade un bloque para ver el correo.</body></html>"
    : modo === "claro"
      ? html.replace(OSCURO, "@media not all")
      : html.replace(OSCURO, "@media all");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-end gap-2">
        <Conmutador>
          <Opcion activa={ancho === "escritorio"} onClick={() => setAncho("escritorio")} label="Escritorio"><Monitor className="size-4" /></Opcion>
          <Opcion activa={ancho === "movil"} onClick={() => setAncho("movil")} label="Móvil"><Smartphone className="size-4" /></Opcion>
        </Conmutador>
        <Conmutador>
          <Opcion activa={modo === "claro"} onClick={() => setModo("claro")} label="Modo claro"><Sun className="size-4" /></Opcion>
          <Opcion activa={modo === "oscuro"} onClick={() => setModo("oscuro")} label="Modo oscuro (Gmail móvil)"><Moon className="size-4" /></Opcion>
        </Conmutador>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto">
        <iframe
          title="Vista previa del correo"
          srcDoc={doc}
          style={{ width: ancho === "escritorio" ? 640 : 390, height: alto }}
          className="shrink-0 rounded-[14px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-[width]"
        />
      </div>
    </div>
  );
}

function Conmutador({ children }: { children: React.ReactNode }) {
  return <div className="flex overflow-hidden rounded-[10px] border border-[#e2ddd6] bg-white">{children}</div>;
}

function Opcion({ activa, onClick, label, children }: { activa: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={activa}
      className={`flex items-center px-3 py-2 ${activa ? "bg-kora-black text-white" : "text-[#6b6f78] hover:bg-[#faf8f5]"}`}>
      {children}
    </button>
  );
}
