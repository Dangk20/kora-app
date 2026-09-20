// Dos guardas del alta de producto que costaron una reunión (13 sep 2026).
//
// El operador, en el paso 2 del alta, vio cómo el modal "se cerraba como si
// guardara, sin pasar al paso 3". Reproducido en local el 19 sep: eran DOS
// fallos distintos con el mismo síntoma, y ninguno daba error.
//
//  1. Seleccionar texto en un campo arrastrando el ratón y SOLTAR FUERA del
//     panel. El navegador dispara `click` en el ancestro común de `mousedown`
//     y `mouseup` —el fondo oscuro—, y el fondo cierra el modal. Se perdía
//     todo lo escrito sin guardar nada.
//  2. Mantener Enter pulsado un instante. La autorrepetición del teclado manda
//     varios `keydown`: el primero avanza al paso 3 y el siguiente, que llega
//     al mismo campo antes de que el navegador le quite el foco, ENVÍA desde
//     el paso 3. Se guardaba un producto sin stock y el modal se cerraba.
//
// Viven aquí, sin React ni DOM, para que la decisión se pueda probar con la
// lógica real y no leyendo el código fuente.

/**
 * El fondo del modal cierra SOLO si el clic empezó y terminó en él.
 *
 * `onMouseDown` recuerda si la pulsación empezó en el fondo; `onClick` cierra
 * solo si además terminó ahí. Un arrastre que empieza dentro del panel y
 * suelta fuera empieza en el panel, así que no cierra.
 */
export function guardaDeFondo(cerrar: () => void) {
  let empezoEnFondo = false;
  return {
    onMouseDown(e: { target: unknown; currentTarget: unknown }) {
      empezoEnFondo = e.target === e.currentTarget;
    },
    onClick(e: { target: unknown; currentTarget: unknown }) {
      const terminoEnFondo = e.target === e.currentTarget;
      if (empezoEnFondo && terminoEnFondo) cerrar();
      empezoEnFondo = false;
    },
  };
}

export type DecisionEnter = "dejar" | "ignorar" | "avanzar" | "enviar";

/**
 * Qué hace Enter en el formulario por pasos.
 *
 * - `dejar`: el navegador sigue con lo suyo (un salto de línea en un área de
 *   texto, la activación de un botón, o un formulario que no va por pasos).
 *   Enter sobre un botón es SU pulsación: tratarlo además como "avanzar"
 *   hacía que "Agregar opción" agregara y saltara de paso a la vez.
 * - `ignorar`: se cancela y no pasa nada. Es el caso de la autorrepetición
 *   (`repeat`) y del campo que quedó en un paso ya OCULTO: los dos son la
 *   misma pulsación que ya avanzó de paso, y dejarla pasar es lo que enviaba.
 * - `avanzar`: en un alta, Enter lleva al paso siguiente.
 * - `enviar`: en el último paso, o en una edición, Enter guarda.
 */
export function decidirEnter(e: {
  porPasos: boolean;
  esAlta: boolean;
  paso: number;
  ultimoPaso: number;
  repeat: boolean;
  enAreaDeTexto: boolean;
  enBoton: boolean;
  enPasoOculto: boolean;
}): DecisionEnter {
  if (!e.porPasos || e.enAreaDeTexto || e.enBoton) return "dejar";
  if (e.repeat || e.enPasoOculto) return "ignorar";
  if (e.esAlta && e.paso < e.ultimoPaso) return "avanzar";
  return "enviar";
}
