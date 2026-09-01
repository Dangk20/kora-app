"use client";

/**
 * Interruptor de encendido/apagado.
 *
 * Es el MISMO aspecto que el switch del listado de productos, extraído aquí
 * para que exista una sola vez: dos interruptores dibujados por separado se
 * separan en cuanto alguien ajusta un tamaño o un color, y el panel acaba con
 * dos formas de decir lo mismo.
 *
 * Sustituye a las casillas en los formularios del panel: una casilla marcada
 * se lee como "seleccionado en una lista"; un interruptor se lee como "esto
 * está encendido", que es lo que significan Activo o Destacado.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  aria,
  encendido,
  apagado,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  /** Texto VISIBLE junto al interruptor. */
  label?: string;
  /**
   * Nombre accesible, cuando el texto visible no basta o no existe. Va aparte
   * de `label` a propósito: mezclarlos hacía que la etiqueta para el lector de
   * pantalla —"Desactivar producto"— se pintara en la pantalla.
   */
  aria?: string;
  /** Texto del estado encendido. Por omisión, ninguno. */
  encendido?: string;
  apagado?: string;
  disabled?: boolean;
}) {
  const estado = checked ? encendido : apagado;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria ?? label}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className="flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {/* Encendido = coral de marca (el primario del sistema); apagado = neutro. */}
      <span
        className={`relative h-6 w-[42px] shrink-0 rounded-full transition-colors ${
          checked ? "bg-kora-coral" : "bg-[#d9d4cc]"
        }`}
      >
        <span
          className="absolute top-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-[left]"
          style={{ left: checked ? 21 : 3 }}
        />
      </span>
      {(label || estado) && (
        <span className="flex items-baseline gap-1.5">
          {label && (
            <span className="text-[13px] font-semibold text-kora-black">{label}</span>
          )}
          {estado && (
            <span
              className={`text-[12.5px] font-semibold ${
                checked ? "text-kora-coral" : "text-[#8a8f98]"
              }`}
            >
              {estado}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
