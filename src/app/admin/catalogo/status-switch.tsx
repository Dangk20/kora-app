"use client";

import { useOptimistic, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
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
    <Switch
      checked={optimistic}
      onCheckedChange={toggle}
      encendido="Activo"
      apagado="Inactivo"
      disabled={disabled}
      aria={optimistic ? "Desactivar producto" : "Activar producto"}
    />
  );
}
