// Área "pedido" de la tienda: el estado de un pedido como lo ve el comprador
// (en su cuenta y en el seguimiento sin cuenta). Los estados se traducen
// AQUÍ, en la vista: el enum `OrderStatus` y `canTransition` no se tocan.
// `en/pedido.ts` debe tener la misma forma.
type EstadoPedido = "PENDING" | "CONFIRMED" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
/** `fecha` ya formateada en el idioma activo; cada frase usa la que necesita. */
type FraseEstado = {
  corta: string;
  titulo: (fecha: string) => string;
  detalle: (fecha: string) => string | null;
};

export const pedido = {
  meta: {
    detalle: "Detalle del pedido · KORA",
    seguimiento: "Seguimiento de tu pedido · KORA",
    seguimientoDescripcion: "Consulta el estado de tu pedido de KORA con su número y tu correo o celular.",
    publico: "Tu pedido · KORA",
  },

  /** Etiqueta corta del estado (insignia). */
  estado: {
    PENDING: "Por confirmar",
    CONFIRMED: "Confirmado",
    PREPARING: "En preparación",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
  } as Record<string, string>,

  /** El estado dicho como lo diría una persona: qué pasa y cuándo. */
  frase: {
    PENDING: { corta: "Por confirmar", titulo: () => "Estamos esperando tu pago", detalle: () => "Se acuerda por WhatsApp. Retoma la conversación para confirmarlo." },
    CONFIRMED: { corta: "Pago confirmado", titulo: (f) => `Confirmado el ${f}`, detalle: () => "Estamos armando tu pedido." },
    PREPARING: { corta: "En preparación", titulo: () => "Estamos preparando tu paquete", detalle: (f) => `Desde el ${f}.` },
    SHIPPED: { corta: "En camino", titulo: (f) => `Enviado el ${f}`, detalle: () => "Te avisamos por correo cuando llegue." },
    DELIVERED: { corta: "Entregado", titulo: (f) => `Llegó el ${f}`, detalle: () => null },
    CANCELLED: { corta: "Cancelado", titulo: (f) => `Cancelado el ${f}`, detalle: () => "Si usaste cashback, ya volvió a tu saldo." },
  } as Record<EstadoPedido, FraseEstado>,

  /** Pasos de la línea de tiempo. */
  pasos: {
    PENDING: "Recibido",
    CONFIRMED: "Confirmado",
    PREPARING: "En preparación",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
  } as Record<string, string>,
  progreso: "Progreso del pedido",
  siguiente: (paso: string) => ` · siguiente: ${paso}`,

  // Tarjeta y detalle
  unidades: (n: number) => `${n} u.`,
  porUnidad: "c/u",
  yMas: (n: number) => `y ${n} producto${n === 1 ? "" : "s"} más`,
  verPedido: "Ver pedido",
  misPedidos: "Mis pedidos",
  reservado: "Tu pedido está reservado. Retoma la conversación para confirmar el pago.",
  registrado: "Tu pedido está registrado y el pago se acuerda por WhatsApp. Retoma la conversación para confirmarlo.",
  continuarWhatsapp: "Continuar por WhatsApp",
  vencido: "Este pedido superó su vigencia sin confirmarse. Si todavía lo quieres, vuelve a armarlo desde el catálogo.",
  productos: "Productos",
  entrega: "Entrega",
  recibe: (nombre: string) => `Recibe: ${nombre}`,
  indicaciones: (texto: string) => `Indicaciones: ${texto}`,
  envioPorWhatsapp: "El envío se coordina contigo por WhatsApp al confirmar.",
  infoCompra: "Información de la compra",
  comprobante: "Comprobante de pedido",
  comprobanteAyuda: "El mismo que te enviamos por correo al confirmar",
  sinComprobanteCancelado: "Un pedido cancelado no genera comprobante.",
  sinComprobante: "El comprobante se genera al confirmar el pago.",
  detalleCompra: "Detalle de la compra",
  filaProductos: (n: number) => `Producto${n === 1 ? "" : "s"}`,
  subtotal: "Subtotal",
  descuento: "Descuento",
  cashback: "Kora Cashback",
  envio: "Envío",
  envioValor: "Por WhatsApp",
  total: "Total",
  cashbackDio: "Te dio",
  cashbackDe: "de Kora Cashback",
  cashbackHasta: (fecha: string) => `, disponible hasta el ${fecha}`,
  cashbackDara: "Al confirmarse te dará",

  // Seguimiento sin cuenta
  seguimiento: {
    titulo: "Seguimiento de tu pedido",
    bajada: "Escribe el número que te dimos al comprar y el correo o celular que usaste. No necesitas crear una cuenta.",
    tienesCuenta: "¿Tienes cuenta?",
    entra: "Entra",
    tienesCuentaResto: "y verás todos tus pedidos y tu saldo de Kora Cashback.",
    numero: "Número del pedido",
    contacto: "Correo o celular con el que compraste",
    placeholderContacto: "correo@ejemplo.com",
    contactoAyuda: "Pedimos este segundo dato para que nadie más pueda ver tu pedido.",
    buscando: "Buscando…",
    ver: "Ver mi pedido",
    volverTienda: "← Volver a la tienda",
    guardaEnlace: "Guarda este enlace para volver a consultar tu pedido.",
    creaCuenta: "Crea una cuenta",
    creaCuentaResto: "y tendrás aquí todos tus pedidos y tu saldo de Kora Cashback.",
  },
};
