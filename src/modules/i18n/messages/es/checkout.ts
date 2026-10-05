// Área "checkout" de la tienda: formulario, resumen, pantalla de proceso,
// invitación de cuenta, puente de WhatsApp y selector de ciudad.
// `en/checkout.ts` debe tener exactamente la misma forma.
//
// Las etiquetas que dependen del PAÍS de quien paga (departamento/estado,
// barrio/ZIP…) van como { CO, US }: el idioma lo decide la tienda, el
// contenido lo decide el país.
type PorPais = { CO: string; US: string };

export const checkout = {
  tituloPagina: "Finalizar pedido",
  volverCarrito: "Volver al carrito",
  titulo: "Finalizar pedido",
  subtitulo: "Completa tus datos y te llevamos a WhatsApp para confirmar el pedido.",

  // Rescate de un pedido creado y no enviado
  pedidoYaCreado: (n: string) => `Tu pedido ${n} ya está creado`,
  pedidoYaCreadoTexto:
    "Todavía no lo enviaste por WhatsApp. Ábrelo para confirmarlo con un asesor; no hace falta volver a llenar nada.",
  abrirWhatsapp: "Abrir WhatsApp",
  descartar: "Descartar",
  nadaQuePedir: "No hay nada que pedir",
  nadaQuePedirTexto: "Tu carrito está vacío o los productos ya no están disponibles.",
  verCatalogo: "Ver el catálogo",

  // Facturación
  facturacionTitulo: "Datos de facturación",
  pais: "País",
  paisCO: "Colombia",
  paisUS: "Estados Unidos",
  nombreCompleto: "Nombre completo",
  nombreEjemplo: { CO: "Ej. Laura Gómez", US: "Ej. John Smith" } as PorPais,
  celular: { CO: "Celular (WhatsApp)", US: "Teléfono" } as PorPais,
  correo: "Correo electrónico",
  correoEjemplo: "correo@ejemplo.com",
  correoDeCuenta: "Es el correo de tu cuenta. Para cambiarlo, entra a Mi cuenta.",
  documento: "Documento de identidad",
  documentoAyuda: "(lo exigen las transportadoras)",
  tipoDocumento: "Tipo de documento",
  direccion: { CO: "Dirección", US: "Dirección de facturación" } as PorPais,
  direccionEjemplo: { CO: "Ej.: Carrera 7 # 82 - 15", US: "Ej. 123 Main St" } as PorPais,
  apto: { CO: "Apto / Torre / Conjunto", US: "Apto / Suite" } as PorPais,
  opcional: "(opcional)",
  barrio: "Barrio",
  barrioEjemplo: "Ej. Chapinero",
  zip: "Código ZIP",

  // Envío
  envioTitulo: "Datos de envío",
  envioNota: {
    CO: "Hacemos envíos dentro de Colombia.",
    US: "Solo enviamos dentro de Colombia — por ejemplo, a un familiar o amigo.",
  } as PorPais,
  mismosDatos: "Usar los mismos datos de facturación",
  direccionesGuardadas: "Mis direcciones guardadas",
  predeterminada: "Predeterminada",
  faltaInformacion: "Falta información",
  libretaAyuda: "Al elegir una se copian sus datos abajo y puedes ajustarlos. Administra tu libreta en",
  misDirecciones: "Mis direcciones",
  nombreRecibe: "Nombre de quien recibe",
  nombreRecibeEjemplo: "Ej. Rosa Gómez",
  celularRecibe: "Celular de quien recibe",
  documentoRecibe: "Documento de quien recibe",
  direccionEnvio: { CO: "Dirección", US: "Dirección (Colombia)" } as PorPais,
  aptoEnvio: { CO: "Apto / Torre / Conjunto", US: "Apto / Torre" } as PorPais,
  barrioEnvio: { CO: "Barrio", US: "Barrio" } as PorPais,
  notasEntrega: "Notas de entrega",
  notasEjemplo: "Ej. Dejar en portería",
  guardarDireccion: "Guardar esta dirección en mi cuenta",

  // Pago y consentimientos
  pagoTitulo: "¿Cómo prefieres pagar?",
  pagoNota: "El pago se coordina contigo por WhatsApp; aquí solo nos dices tu preferencia.",
  /** El valor del método viaja en español al pedido; esto solo cambia lo que se lee. */
  metodoPago: (m: string) => m,
  autorizoDatos: "Autorizo el tratamiento de mis datos personales para gestionar este pedido, conforme a la",
  politicaDatos: "política de tratamiento de datos",
  quieroNovedades: "Quiero recibir novedades y promociones de KORA.",
  aceptasTerminos: "Al crear el pedido aceptas nuestros",
  terminos: "términos y condiciones",
  yLa: "y la",
  politicaCambios: "política de cambios y garantía",

  // Resumen
  tuPedido: "Tu pedido",
  quitarCupon: "Quitar cupón",
  tienesCupon: "¿Tienes un cupón?",
  codigo: "CÓDIGO",
  aplicar: "Aplicar",
  usarCashback: "Usar mi Kora Cashback",
  disponible: (monto: string) => `(${monto} disponible)`,
  noCuponYCashback: "No puedes usar un cupón y tu Kora Cashback en la misma compra.",
  tienesCashback: "¿Tienes Kora Cashback?",
  iniciaSesion: "Inicia sesión",
  paraDescontar: "para descontarlo de esta compra.",
  subtotal: "Subtotal",
  koraCashback: "Kora Cashback",
  total: "Total",
  envioPorWhatsapp: "El envío se acuerda por WhatsApp.",
  creandoPedido: "Creando pedido…",
  confirmarYEnviar: "Confirmar y enviar por WhatsApp",
  aceptaDatosParaSeguir: "Para continuar, acepta el tratamiento de tus datos",
  revisaDatos: "Revisa los datos marcados arriba.",
  quedaRegistrado: "Tu pedido queda registrado en KORA antes de abrir WhatsApp.",

  /**
   * Errores que vienen del servidor (validaciones del pedido, cupón, cashback,
   * cuenta). Se traducen AQUÍ, en el borde, y no en las reglas: las reglas del
   * pedido no saben de idiomas. En español es el mismo texto.
   */
  errorServidor: (mensaje: string) => mensaje,

  // Pantalla de proceso
  pasos: [
    { texto: "Guardando tu pedido", detalle: "Estamos registrando tus productos" },
    { texto: "Confirmando disponibilidad", detalle: "Revisamos precios y existencias" },
    { texto: "Aplicando tus beneficios", detalle: "Descuentos y Kora Cashback" },
    { texto: "Casi listo", detalle: "Te conectamos con un asesor por WhatsApp" },
  ],
  noCierres: "No cierres esta ventana. Tardamos unos segundos.",

  // Puente de WhatsApp
  pedidoCreado: (n: string) => `¡Tu pedido ${n} fue creado! 🔥`,
  abrimosWhatsapp: "Abrimos WhatsApp con tu pedido listo para enviar.",
  teLlevamos: "Te estamos llevando a WhatsApp con tu pedido listo para enviar…",
  importante: "Importante:",
  seConfirma: "tu pedido se confirma cuando completes la conversación en WhatsApp. Tiene una validez de",
  horas: (h: number) => `${h} horas`,
  seguirComprando: "Seguir comprando",

  // Invitación de cuenta
  pedidoListo: (n: string) => `Tu pedido ${n} está listo`,
  ofertaConCuenta: "Ya tienes una cuenta con este correo. ¿Quieres entrar para seguir este pedido desde ahí?",
  ofertaSinCuenta:
    "Guarda tus datos y sigue este pedido desde tu cuenta. Solo tienes que elegir una contraseña — el resto ya lo tenemos.",
  beneficioSeguir: "Sigue el estado de este pedido y de los que vengan",
  beneficioCashback: (monto: string) => `Generará ${monto} de Kora Cashback a tu nombre`,
  beneficioConCuenta: "Este pedido ya quedó en tu cuenta: entrar solo es para verlo ahora",
  beneficioSinCuenta: "Compra más rápido: no vuelves a escribir tus datos",
  iniciarSesion: "Iniciar sesión",
  crearMiCuenta: "Crear mi cuenta",
  noEnOtroMomento: "No, en otro momento",
  enOtroMomento: "En otro momento",
  escribeContrasena: "Escribe tu contraseña para entrar.",
  eligeContrasena: "Elige tu contraseña. Es lo único que falta.",
  contrasena: "Contraseña",
  minimoCaracteres: (n: number) => `Mínimo ${n} caracteres.`,
  repiteContrasena: "Repite la contraseña",
  entrando: "Entrando…",
  creandoCuenta: "Creando tu cuenta…",
  entrarYContinuar: "Entrar y continuar",
  crearCuentaYContinuar: "Crear cuenta y continuar",

  // Selector departamento/estado → ciudad
  division: { CO: "Departamento", US: "Estado" } as PorPais,
  ciudad: { CO: "Ciudad / Municipio", US: "Ciudad" } as PorPais,
  selecciona: "Selecciona…",
  primeroDivision: { CO: "Primero el departamento", US: "Primero el estado" } as PorPais,
  ciudadEjemplo: "Ej. Miami",
};
