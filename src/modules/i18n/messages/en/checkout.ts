import type { checkout as es } from "../es/checkout";

/**
 * Errores del servidor que puede ver el comprador en el checkout, en
 * español → inglés. Los mensajes viven en las reglas (pedido, direcciones,
 * cupón, cashback, cuenta) y NO se tocan ahí: se traducen en el borde. Lo que
 * no esté aquí se muestra en español, nunca vacío.
 */
const ERRORES: Record<string, string> = {
  // Reglas de dirección y contacto (orders/address-rules.ts)
  "Escribe el barrio": "Enter the neighborhood (barrio)",
  "Elige un municipio del departamento seleccionado": "Choose a city in the selected department",
  "ZIP inválido (##### o #####-####)": "Invalid ZIP code (##### or #####-####)",
  "Choose a city in the selected state": "Choose a city in the selected state",
  "Escribe tu número de documento": "Enter your ID number",
  "El celular debe tener 10 dígitos": "The mobile number must have 10 digits",
  // Esquema y flujo del pedido (orders/checkout-actions.ts)
  "Escribe la dirección": "Enter the address",
  "Escribe la ciudad": "Enter the city",
  "Selecciona el departamento o estado": "Select the department or state",
  "Escribe tu nombre completo": "Enter your full name",
  "Correo inválido": "Invalid email address",
  "Teléfono inválido": "Invalid phone number",
  "Solo hacemos envíos dentro de Colombia": "We only ship within Colombia",
  "Escribe el nombre de quien recibe": "Enter the recipient's name",
  "Celular inválido": "Invalid mobile number",
  "Elige un método de pago": "Choose a payment method",
  "Debes aceptar el tratamiento de datos": "You must accept the personal data policy",
  "Escribe a quién se le envía en Colombia": "Enter who receives the order in Colombia",
  "Escribe a quién se le envía": "Enter who receives the order",
  "Tu carrito está vacío o los productos ya no están disponibles":
    "Your cart is empty or the products are no longer available",
  "Tu saldo de Kora Cashback cambió mientras completabas el pedido. Vuelve a intentarlo.":
    "Your Kora Cashback balance changed while you were checking out. Please try again.",
  "No pudimos crear tu pedido. Intenta de nuevo.": "We couldn't create your order. Please try again.",
  // Cupón (coupons/messages.ts y apply-action.ts)
  "Escribe un código.": "Enter a code.",
  "Cupón no válido.": "Invalid coupon.",
  "Este cupón no está vigente.": "This coupon isn't active.",
  "Este cupón ya alcanzó su límite de usos.": "This coupon has reached its usage limit.",
  "Tu compra no alcanza el mínimo de este cupón.": "Your order doesn't reach this coupon's minimum.",
  "Este cupón no aplica a los productos de tu carrito.": "This coupon doesn't apply to the items in your cart.",
  "Este cupón es solo para tu primera compra.": "This coupon is only for your first purchase.",
  "Ya usaste este cupón el máximo de veces permitido.": "You've already used this coupon the maximum number of times.",
  // Kora Cashback (cashback/redemption.ts)
  "Entra a tu cuenta para usar tu Kora Cashback.": "Sign in to use your Kora Cashback.",
  "No tienes saldo de Kora Cashback disponible en esta moneda.":
    "You don't have Kora Cashback available in this currency.",
  "No puedes usar un cupón y tu Kora Cashback en la misma compra.":
    "You can't use a coupon and your Kora Cashback on the same order.",
  "No aplicaste Kora Cashback.": "You didn't apply Kora Cashback.",
  // Cuenta al terminar la compra (checkout/cuenta-actions.ts, buyer/*)
  "Las dos contraseñas no coinciden.": "The passwords don't match.",
  "La contraseña debe tener al menos 8 caracteres.": "Your password must be at least 8 characters.",
  "No encontramos tu pedido. Vuelve a intentarlo desde tu cuenta.":
    "We couldn't find your order. Please try again from your account.",
  "No encontramos tu pedido.": "We couldn't find your order.",
  "Ese correo ya tiene una cuenta. Entra con tu contraseña desde «Mi cuenta».":
    "That email already has an account. Sign in with your password from “My account”.",
  "Correo o contraseña incorrectos.": "Incorrect email or password.",
  "Escribe tu nombre completo.": "Enter your full name.",
};

/** Mensajes con datos dentro: se reconocen por su forma. */
const PATRONES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Este cupón no aplica para compras en (.+)\.$/, (m) => `This coupon doesn't apply to purchases in ${m[1]}.`],
  [/^Este cupón aplica desde (.+)\.$/, (m) => `This coupon applies to orders from ${m[1]}.`],
  [/^Demasiados intentos\. Espera (\d+) minuto\(s\)\.$/, (m) => `Too many attempts. Wait ${m[1]} minute(s).`],
];

const PAGOS: Record<string, string> = {
  "Transferencia Bancolombia": "Bancolombia bank transfer",
  "Efectivo contra entrega": "Cash on delivery",
  "Otro (a acordar por WhatsApp)": "Other (arranged on WhatsApp)",
};

export const checkout: typeof es = {
  tituloPagina: "Checkout",
  volverCarrito: "Back to cart",
  titulo: "Checkout",
  subtitulo: "Fill in your details and we'll take you to WhatsApp to confirm your order.",

  pedidoYaCreado: (n: string) => `Your order ${n} has already been created`,
  pedidoYaCreadoTexto:
    "You haven't sent it on WhatsApp yet. Open it to confirm with an advisor — no need to fill anything in again.",
  abrirWhatsapp: "Open WhatsApp",
  descartar: "Dismiss",
  nadaQuePedir: "Nothing to order",
  nadaQuePedirTexto: "Your cart is empty or the products are no longer available.",
  verCatalogo: "Browse the catalog",

  facturacionTitulo: "Billing details",
  pais: "Country",
  paisCO: "Colombia",
  paisUS: "United States",
  nombreCompleto: "Full name",
  nombreEjemplo: { CO: "e.g. Laura Gómez", US: "e.g. John Smith" },
  celular: { CO: "Mobile (WhatsApp)", US: "Phone" },
  correo: "Email",
  correoEjemplo: "you@example.com",
  correoDeCuenta: "This is your account email. To change it, go to My account.",
  documento: "ID number (cédula)",
  documentoAyuda: "(required by the shipping carriers)",
  tipoDocumento: "ID type",
  direccion: { CO: "Address", US: "Billing address" },
  direccionEjemplo: { CO: "e.g. Carrera 7 # 82 - 15", US: "e.g. 123 Main St" },
  apto: { CO: "Apt / Tower / Complex", US: "Apt / Suite" },
  opcional: "(optional)",
  barrio: "Neighborhood (barrio)",
  barrioEjemplo: "e.g. Chapinero",
  zip: "ZIP code",

  envioTitulo: "Shipping details",
  envioNota: {
    CO: "We ship within Colombia.",
    US: "We only ship within Colombia — e.g. to a relative or friend.",
  },
  mismosDatos: "Use the same details as billing",
  direccionesGuardadas: "My saved addresses",
  predeterminada: "Default",
  faltaInformacion: "Missing information",
  libretaAyuda: "Choosing one copies its details below so you can adjust them. Manage your address book in",
  misDirecciones: "My addresses",
  nombreRecibe: "Recipient's name",
  nombreRecibeEjemplo: "e.g. Rosa Gómez",
  celularRecibe: "Recipient's mobile",
  documentoRecibe: "Recipient's ID number",
  direccionEnvio: { CO: "Address", US: "Street address (Colombia)" },
  aptoEnvio: { CO: "Apt / Tower / Complex", US: "Apt / Tower" },
  barrioEnvio: { CO: "Neighborhood (barrio)", US: "Neighborhood (barrio)" },
  notasEntrega: "Delivery notes",
  notasEjemplo: "e.g. Leave at the front desk",
  guardarDireccion: "Save this address to my account",

  pagoTitulo: "How would you like to pay?",
  pagoNota: "Payment is arranged with you on WhatsApp; here you just tell us your preference.",
  metodoPago: (m: string) => PAGOS[m] ?? m,
  autorizoDatos: "I authorize the processing of my personal data to handle this order, in accordance with the",
  politicaDatos: "personal data policy (Spanish)",
  quieroNovedades: "I'd like to receive news and promotions from KORA.",
  aceptasTerminos: "By placing the order you accept our",
  terminos: "terms and conditions (Spanish)",
  yLa: "and the",
  politicaCambios: "returns and warranty policy (Spanish)",

  tuPedido: "Your order",
  quitarCupon: "Remove coupon",
  tienesCupon: "Have a coupon?",
  codigo: "CODE",
  aplicar: "Apply",
  usarCashback: "Use my Kora Cashback",
  disponible: (monto: string) => `(${monto} available)`,
  noCuponYCashback: "You can't use a coupon and your Kora Cashback on the same order.",
  tienesCashback: "Have Kora Cashback?",
  iniciaSesion: "Sign in",
  paraDescontar: "to apply it to this order.",
  subtotal: "Subtotal",
  koraCashback: "Kora Cashback",
  total: "Total",
  envioPorWhatsapp: "Shipping is arranged on WhatsApp.",
  creandoPedido: "Placing order…",
  confirmarYEnviar: "Confirm and send via WhatsApp",
  aceptaDatosParaSeguir: "To continue, accept the personal data policy",
  revisaDatos: "Please check the highlighted fields above.",
  quedaRegistrado: "Your order is saved in KORA before WhatsApp opens.",

  errorServidor: (mensaje: string) => {
    if (ERRORES[mensaje]) return ERRORES[mensaje];
    for (const [patron, traducir] of PATRONES) {
      const m = mensaje.match(patron);
      if (m) return traducir(m);
    }
    return mensaje;
  },

  pasos: [
    { texto: "Saving your order", detalle: "We're recording your products" },
    { texto: "Checking availability", detalle: "We're reviewing prices and stock" },
    { texto: "Applying your benefits", detalle: "Discounts and Kora Cashback" },
    { texto: "Almost there", detalle: "Connecting you with an advisor on WhatsApp" },
  ],
  noCierres: "Don't close this window. It only takes a few seconds.",

  pedidoCreado: (n: string) => `Your order ${n} has been created! 🔥`,
  abrimosWhatsapp: "We opened WhatsApp with your order ready to send.",
  teLlevamos: "Taking you to WhatsApp with your order ready to send…",
  importante: "Important:",
  seConfirma: "your order is confirmed once you complete the WhatsApp conversation. It's valid for",
  horas: (h: number) => `${h} hours`,
  seguirComprando: "Keep shopping",

  pedidoListo: (n: string) => `Your order ${n} is ready`,
  ofertaConCuenta: "You already have an account with this email. Would you like to sign in to track this order there?",
  ofertaSinCuenta:
    "Save your details and track this order from your account. Just choose a password — we already have the rest.",
  beneficioSeguir: "Track the status of this order and future ones",
  beneficioCashback: (monto: string) => `It will earn ${monto} in Kora Cashback for you`,
  beneficioConCuenta: "This order is already in your account: signing in just lets you see it now",
  beneficioSinCuenta: "Check out faster: no need to type your details again",
  iniciarSesion: "Sign in",
  crearMiCuenta: "Create my account",
  noEnOtroMomento: "No, maybe later",
  enOtroMomento: "Maybe later",
  escribeContrasena: "Enter your password to sign in.",
  eligeContrasena: "Choose your password. That's all that's left.",
  contrasena: "Password",
  minimoCaracteres: (n: number) => `At least ${n} characters.`,
  repiteContrasena: "Repeat your password",
  entrando: "Signing in…",
  creandoCuenta: "Creating your account…",
  entrarYContinuar: "Sign in and continue",
  crearCuentaYContinuar: "Create account and continue",

  division: { CO: "Department (state)", US: "State" },
  ciudad: { CO: "City / Municipality", US: "City" },
  selecciona: "Select…",
  primeroDivision: { CO: "Select a department first", US: "Select a state first" },
  ciudadEjemplo: "e.g. Miami",
};
