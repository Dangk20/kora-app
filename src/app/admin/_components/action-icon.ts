// El aspecto de una acción de fila en los listados del panel.
//
// UNA sola definición. El panel llegó a tener tres formas de lo mismo —un
// botón con texto en Pedidos, un icono con fondo gris en Clientes y Cupones, y
// un icono transparente en Productos e Inventario—, y en una tabla eso hace
// que acciones idénticas parezcan de rangos distintos.
//
// Transparente y no con chip: en una tabla densa, un fondo por fila compite
// con los datos. El color aparece al pasar el cursor, que es cuando importa.
export const ACTION_ICON =
  "flex size-8 items-center justify-center rounded-lg text-[#b3b8c0] transition-colors hover:bg-[#FFE9DD] hover:text-kora-coral";

/** Variante destructiva: mismo tamaño, rojo al pasar el cursor. */
export const ACTION_ICON_DANGER =
  "flex size-8 items-center justify-center rounded-lg text-[#b3b8c0] transition-colors hover:bg-[#fdecec] hover:text-destructive";

/**
 * Cuando la FILA entera es el enlace, el icono no es un botón: es la señal de
 * que la fila se abre. Entonces tiene que encenderse al pasar el cursor por
 * cualquier parte de la fila —no solo por encima de los 32 px del icono—, o
 * parece apagado justo cuando el usuario está apuntando a él.
 * Exige `group` en el contenedor de la fila.
 */
export const ACTION_ICON_ROW = `${ACTION_ICON} group-hover:bg-[#FFE9DD] group-hover:text-kora-coral`;
