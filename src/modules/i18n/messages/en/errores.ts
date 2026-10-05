import type { errores as es } from "../es/errores";

/**
 * Español → inglés de los mensajes que nacen en reglas puras. La clave es el
 * texto EXACTO que devuelven; si una regla cambia su redacción y nadie
 * actualiza esto, el comprador ve el español (nunca un hueco).
 */
const DESDE_ESPANOL: Record<string, string> = {
  // modules/buyer/account.ts — mismo mensaje haya o no cuenta
  "Correo o contraseña incorrectos.": "Incorrect email or password.",
  "Listo. Si el correo no tenía cuenta, ya está creada; si ya la tenía, entra con tu contraseña.":
    "Done. If that email didn't have an account, it's been created; if it already did, sign in with your password.",
  "Escribe tu nombre completo.": "Please enter your full name.",
  "La contraseña actual no es correcta.": "Your current password is incorrect.",
  // modules/buyer/password.ts
  "La contraseña debe tener al menos 8 caracteres.": "Your password must be at least 8 characters.",
  // modules/buyer/reset.ts — mismo mensaje exista o no el correo
  "Si ese correo tiene una cuenta, te enviamos un código de 6 dígitos. Revisa tu bandeja y la carpeta de spam.":
    "If that email has an account, we've sent a 6-digit code. Check your inbox and spam folder.",
  "El código no es válido o ya caducó. Pide uno nuevo.": "The code is invalid or has expired. Request a new one.",
  // modules/orders/tracking.ts — mismo mensaje para formato inválido y pedido inexistente
  "No encontramos un pedido con esos datos. Revisa el número y el correo o celular que usaste al comprarlo.":
    "We couldn't find an order with those details. Check the order number and the email or phone you used.",
  // cuenta/direcciones-actions.ts
  "Escribe la dirección de entrega.": "Please enter the delivery address.",
  "Escribe la ciudad.": "Please enter the city.",
  "Solo hacemos envíos dentro de Colombia.": "We only ship within Colombia.",
  "Elige el departamento.": "Please choose the department (state).",
  "Escribe el barrio.": "Please enter the neighborhood.",
};

export const errores: typeof es = {
  traducir: (mensaje: string) => DESDE_ESPANOL[mensaje] ?? mensaje,
  demasiadosIntentos: (min: number) =>
    `Too many attempts. Try again in ${min} minute${min === 1 ? "" : "s"}.`,
  demasiadosIntentosEspera: (min: number) =>
    `Too many attempts. Wait ${min} minute${min === 1 ? "" : "s"} and try again.`,
  yaExisteCuenta: "An account with that email already exists. Sign in with your password or message us on WhatsApp.",
  nombreCompleto: "Please enter your full name.",
  whatsappInvalido: "That WhatsApp number doesn't look valid. Please check it.",
  whatsappDeOtro: "That number is already registered to another account.",
  direccionNoEncontrada: "We couldn't find that address.",

  pagina: {
    titulo: "We couldn't load this page",
    cuerpo: "Check your connection and try again. If it keeps happening, message us on WhatsApp and we'll help.",
    reintentar: "Try again",
    irCatalogo: "Go to the catalog",
  },
};
