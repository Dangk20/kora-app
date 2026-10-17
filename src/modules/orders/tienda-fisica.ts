// La tienda física de KORA, a donde va quien elige "Recoger en tienda"
// (change entrega-recoger-o-envio, 17 oct 2026).
//
// Dirección y horario confirmados por Daniel el 17 oct 2026. Viven aquí como
// valor por omisión y el ENTORNO los puede cambiar sin desplegar código
// (`KORA_TIENDA_DIRECCION`, `KORA_TIENDA_HORARIO`). Si alguien los vacía a
// propósito con un espacio, el checkout dice que se confirman por WhatsApp:
// lo que NUNCA se publica es un texto de relleno ("[DIRECCIÓN PENDIENTE]").

/** La única ciudad donde se puede recoger. Va en la etiqueta "SOLO EN NEIVA". */
export const CIUDAD_RECOGIDA = "Neiva";
export const DEPARTAMENTO_RECOGIDA = "Huila";

/** La tienda de Neiva: es la misma dirección del domicilio legal de KORA SHOPP S.A.S. */
const DIRECCION_TIENDA = "Calle 25 Sur # 32-23, Neiva, Huila";
const HORARIO_TIENDA = "Horario: 9:00 a. m. a 6:00 p. m.";

export type TiendaFisica = {
  ciudad: string;
  departamento: string;
  /** `null` = sin configurar: se confirma por WhatsApp. */
  direccion: string | null;
  horario: string | null;
};

export function tiendaFisica(env: NodeJS.ProcessEnv = process.env): TiendaFisica {
  // Variable ausente = el valor confirmado; variable presente = manda ella
  // (en blanco = "sin dato": se confirma por WhatsApp).
  const valor = (v: string | undefined, porOmision: string) =>
    v === undefined ? porOmision : v.trim() || null;
  return {
    ciudad: CIUDAD_RECOGIDA,
    departamento: DEPARTAMENTO_RECOGIDA,
    direccion: valor(env.KORA_TIENDA_DIRECCION, DIRECCION_TIENDA),
    horario: valor(env.KORA_TIENDA_HORARIO, HORARIO_TIENDA),
  };
}
