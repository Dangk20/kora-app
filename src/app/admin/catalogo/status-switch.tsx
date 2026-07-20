"use client";

import { useOptimistic, useTransition } from "react";
import { toggleProductActive } from "@/modules/catalog/product-actions";

/**
 * Switch Activo/Inactivo del listado (patrón del toggle del prototipo).
 * Optimista: el switch se mueve al instante y se revierte solo si el
 * servidor rechaza el cambio.
 */
export function StatusSwitch({
  productId,
  active,
  disabled = false,
}: {
  productId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (disabled || pending) return;
    startTransition(async () => {
      setOptimistic(!optimistic);
      await toggleProductActive(productId, !optimistic);
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={optimistic ? "Desactivar producto" : "Activar producto"}
      onClick={toggle}
      disabled={disabled}
      className="flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {/* Encendido = coral de marca (el primario del sistema); apagado = neutro. */}
      <span
        className={`relative h-6 w-[42px] shrink-0 rounded-full transition-colors ${
          optimistic ? "bg-kora-coral" : "bg-[#d9d4cc]"
        }`}
      >
        <span
          className="absolute top-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-[left]"
          style={{ left: optimistic ? 21 : 3 }}
        />
      </span>
      <span
        className={`text-[12.5px] font-semibold ${
          optimistic ? "text-kora-coral" : "text-[#8a8f98]"
        }`}
      >
        {optimistic ? "Activo" : "Inactivo"}
      </span>
    </button>
  );
}
