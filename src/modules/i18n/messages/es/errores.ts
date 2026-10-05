// Área "errores" de la tienda: la pantalla de error y los mensajes que llegan
// del servidor al comprador. `en/errores.ts` debe tener la misma forma.
//
// `traducir` existe para los mensajes que nacen en reglas puras
// (`modules/buyer/account.ts`, `reset.ts`, `password.ts`, seguimiento,
// libreta): esas reglas siguen escribiendo en español —las prueban así y no
// saben de idiomas— y la acción traduce en el BORDE, justo antes de
// devolverlo. En español es la identidad; en inglés, un mapa con caída al
// español: un mensaje nuevo sin traducir se ve en español, nunca vacío.
//
// ⚠️ Los mensajes de seguridad (idénticos haya o no cuenta) se traducen uno a
// uno: siguen siendo IDÉNTICOS entre sí en cada idioma.
export const errores = {
  traducir: (mensaje: string) => mensaje,
  demasiadosIntentos: (min: number) =>
    `Demasiados intentos. Vuelve a intentarlo en ${min} minuto${min === 1 ? "" : "s"}.`,
  demasiadosIntentosEspera: (min: number) => `Demasiados intentos. Espera ${min} minuto(s) y vuelve a probar.`,
  yaExisteCuenta: "Ya existe una cuenta con ese correo. Entra con tu contraseña o escríbenos por WhatsApp.",
  nombreCompleto: "Escribe tu nombre completo.",
  whatsappInvalido: "Ese número de WhatsApp no parece válido. Revísalo.",
  whatsappDeOtro: "Ese número ya está registrado en otra cuenta.",
  direccionNoEncontrada: "No encontramos esa dirección.",

  pagina: {
    titulo: "No pudimos cargar esta página",
    cuerpo: "Revisa tu conexión e intenta de nuevo. Si sigue pasando, escríbenos por WhatsApp y te ayudamos.",
    reintentar: "Intentar de nuevo",
    irCatalogo: "Ir al catálogo",
  },
};
