// Área "cuenta" de la tienda: acceso, registro, recuperación, "Mi cuenta"
// (datos, contraseña, direcciones, Kora Cashback), la baja de promociones y
// el marco de las páginas legales. `en/cuenta.ts` debe tener la misma forma.
//
// Los mensajes de seguridad (mismo texto haya o no cuenta) viven en
// `errores.traducir`: aquí solo lo que dibuja la pantalla.
export const cuenta = {
  meta: {
    entrar: "Entrar a mi cuenta · KORA",
    crear: "Crear mi cuenta · KORA",
    recuperar: "Recuperar tu contraseña · KORA",
    cuenta: "Mi cuenta · KORA",
    baja: "Suscripción · KORA",
  },

  entrar: {
    titulo: "Entrar a mi cuenta",
    bajada: "Consulta tu Kora Cashback, tus pedidos y tus datos.",
    boton: "Entrar",
    enviando: "Entrando…",
    olvidaste: "¿Olvidaste tu contraseña?",
    sinCuenta: "¿No tienes cuenta?",
    creala: "Créala aquí",
  },
  crear: {
    titulo: "Crear mi cuenta",
    bajada: "Guarda tus pedidos y sigue tu Kora Cashback: el 3 % de lo que pagas vuelve a ti.",
    nombre: "Nombre completo",
    whatsappOpcional: "WhatsApp (opcional)",
    whatsappAyuda: "Es por donde confirmamos los pedidos.",
    boton: "Crear cuenta",
    enviando: "Creando…",
    yaTienes: "¿Ya tienes cuenta?",
    entraAqui: "Entra aquí",
  },
  correo: "Correo",
  contrasena: "Contraseña",
  minimoCaracteres: (n: number) => `Mínimo ${n} caracteres.`,
  mostrarContrasena: "Mostrar contraseña",
  ocultarContrasena: "Ocultar contraseña",

  recuperar: {
    titulo: "Recuperar tu contraseña",
    bajada: "Te enviamos un código de 6 dígitos al correo de tu cuenta.",
    tuCorreo: "Tu correo",
    placeholderCorreo: "correo@ejemplo.com",
    enviarCodigo: "Enviarme el código",
    enviando: "Enviando…",
    volverAEntrar: "Volver a entrar",
    codigo: "Código de 6 dígitos",
    nueva: "Tu contraseña nueva",
    cambiar: "Cambiar mi contraseña",
    cambiando: "Cambiando…",
    noLlego: "¿No te llegó?",
    pedirOtro: "Pedir otro código",
  },

  hola: (nombre: string) => `Hola, ${nombre}`,
  secciones: {
    pedidos: "Mis pedidos",
    cashback: "Kora Cashback",
    direcciones: "Mis direcciones",
    datos: "Mis datos",
  } as Record<string, string>,
  seccionesAria: "Secciones de la cuenta",
  sinPedidos: "Todavía no has hecho ningún pedido.",
  sinPedidosMovil: "Aún no tienes pedidos.",
  verCatalogo: "Ver el catálogo",
  cerrarSesion: "Cerrar sesión",

  // "Mi información" y contraseña
  editar: "Editar",
  cambiar: "Cambiar",
  cancelar: "Cancelar",
  guardar: "Guardar",
  guardando: "Guardando…",
  sinRegistrar: "Sin registrar",
  miInformacion: "Mi información",
  nombreCompleto: "Nombre completo",
  correoConEsteEntras: "Correo (con este entras)",
  whatsapp: "WhatsApp",
  datosActualizados: "Datos actualizados.",
  pedidosConservan: "Tus pedidos anteriores conservan los datos con los que se hicieron.",
  contrasenaActual: "Contraseña actual",
  contrasenaNueva: "Contraseña nueva",
  cambiarContrasena: "Cambiar contraseña",
  contrasenaCambiada: "Contraseña cambiada. Se cerraron tus sesiones en otros dispositivos.",
  alCambiarla: "Al cambiarla se cierran tus sesiones en otros dispositivos.",

  // Libreta de direcciones
  direcciones: {
    soloColombia: "Hacemos envíos dentro de Colombia.",
    etiqueta: "Nombre para reconocerla (Casa, Oficina…)",
    direccion: "Dirección",
    direccion2: "Apartamento, torre, conjunto (opcional)",
    barrio: "Barrio",
    indicaciones: "Indicaciones de entrega (opcional)",
    usarPredeterminada: "Usar como dirección predeterminada",
    guardarCambios: "Guardar cambios",
    guardarDireccion: "Guardar dirección",
    eliminar: "Eliminar",
    eliminarAria: (que: string) => `Eliminar la dirección ${que}`,
    confirmarTitulo: "¿Eliminar esta dirección?",
    confirmarCuerpo: "saldrá de tu libreta. Tus pedidos anteriores conservan la dirección con la que se hicieron.",
    siEliminar: "Sí, eliminarla",
    editarTitulo: "Editar dirección",
    predeterminada: "Predeterminada",
    marcarPredeterminada: "Usar como predeterminada",
    vacia: "Todavía no tienes direcciones guardadas.",
    vaciaAyuda: "Guarda una y no tendrás que escribirla en cada compra.",
    nueva: "Nueva dirección",
    agregar: "Agregar una dirección",
  },

  // Kora Cashback
  cashback: {
    titulo: "Kora Cashback",
    vacio1: "Todavía no tienes saldo. Recibe el",
    vacio2: "de lo que pagas en cada compra y úsalo como descuento en la siguiente. Se acredita cuando confirmamos tu pedido por WhatsApp.",
    disponible: (moneda: string) => `Disponible ${moneda}`,
    pendienteTarjeta: "pendiente — estará disponible cuando confirmemos tu pedido.",
    vence: (fecha: string) => `Lo próximo vence el ${fecha}.`,
    generadoTotal: "Generado en total",
    usadoTotal: "Usado en total",
    historial: "Historial",
    pedido: (numero: string | number) => ` · pedido ${numero}`,
    tipos: {
      EARN: "Ganado",
      REDEEM: "Usado",
      EXPIRE: "Vencido",
      ADJUST: "Ajuste",
    } as Record<string, string>,
    comoUsarlo: "Puedes usarlo como descuento al finalizar tu próxima compra. No se combina con cupones.",
    disponibleMovil: "Kora Cashback disponible",
    ganas: "Ganas 3% en cada pedido confirmado",
    pendienteMovil: "pendiente — se acredita cuando confirmemos tu pedido.",
  },

  // Baja de promociones por correo
  baja: {
    invalidoTitulo: "No pudimos procesar el enlace",
    invalido: "El enlace no es válido o se copió incompleto. Si quieres dejar de recibir nuestros correos, escríbenos por WhatsApp y lo hacemos por ti.",
    listo: "Listo",
    noRecibiras: "No volverás a recibir promociones de KORA.",
    resuscritoTitulo: "Vuelves a estar suscrito",
    bajaTitulo: "Listo, ya no recibirás promociones",
    resuscrito: "Volverás a recibir nuestras ofertas y novedades. Puedes darte de baja cuando quieras desde cualquier correo.",
    bajaCuerpo: "No volverás a recibir promociones de KORA. Los mensajes sobre tus pedidos siguen llegando: no dependen de esta suscripción.",
    volverASuscribirme: "Me desuscribí sin querer, volver a suscribirme",
    volverTienda: "Volver a la tienda",
  },

  // Marco de las páginas legales (el contenido sigue en español)
  legal: {
    inicio: "Inicio",
    actualizado: (fecha: string) => `Última actualización: ${fecha}`,
    /** Solo en inglés: el documento no está traducido. */
    soloEspanol: null as string | null,
    borradorTitulo: "Borrador:",
    borrador: "faltan los datos del comerciante (razón social, NIT, domicilio y correo de contacto). Este documento no puede publicarse así.",
  },
};
