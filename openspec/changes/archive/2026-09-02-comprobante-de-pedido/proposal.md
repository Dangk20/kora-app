## Why

Hoy, cuando el operador confirma un pedido, el comprador recibe un correo que le
dice que su pago quedó confirmado — y nada más. No queda **ningún documento**:
ni para el comprador, que pagó por fuera de la plataforma (por WhatsApp, sin
pasarela) y por tanto no tiene comprobante de banco atado a la compra; ni para
el negocio, que no puede entregar un soporte cuando alguien lo pide.

Es el hueco más visible del flujo "pedido → WhatsApp": el pago ocurre fuera y la
plataforma no emite nada que lo respalde.

Además, KORA venderá con **factura electrónica** ante la DIAN más adelante. Eso
exige habilitación, resolución de numeración, CUFE, proveedor tecnológico y
datos fiscales que hoy el sistema no tiene. Ese camino no se puede improvisar,
pero el botón debe existir desde ya, anunciado, para que el cliente y el
comprador sepan que llega.

## What Changes

- **Al confirmar un pedido se congela un documento de venta** (snapshot propio,
  aparte del snapshot del pedido) con los datos del comerciante, del comprador,
  las líneas y los totales tal como estaban en ese instante.
- **Ese documento se renderiza como PDF** y viaja **adjunto en el correo de
  pedido confirmado** al comprador.
- **Se puede ver y descargar desde el panel** (detalle del pedido) y desde la
  **cuenta del comprador**, sin volver a calcular nada: sale del documento
  congelado.
- **El contrato de envío de correo acepta adjuntos** (hoy no los contempla).
  En desarrollo el PDF se escribe a disco junto al `.html`, como el resto.
- **Botón "Factura electrónica" presente y desactivado, con la etiqueta "Muy
  pronto"**, y una explicación de qué falta — el mismo patrón que Email
  marketing, que se enseña en vez de esconderse.
- **El documento NO se titula "Factura de venta"** — ver la decisión abajo.

### Decisión de nombre: "Comprobante de pedido", no "Factura"

Daniel pidió "una factura" y distinguió correctamente que la factura
electrónica es otra cosa. Este documento se llama **Comprobante de pedido** y
lleva impreso que no es una factura electrónica de venta. Dos razones, y la
segunda es la práctica:

1. En Colombia una "Factura de Venta" numerada exige numeración autorizada por
   la DIAN (prefijo y resolución). Emitir un PDF titulado "Factura de Venta
   No. 7943" sin esa autorización no produce una factura incompleta: produce un
   documento que dice ser algo que no es.
2. **Cuando llegue la factura electrónica habrá DOS documentos por la misma
   compra**, con numeraciones distintas (la nuestra y la de la DIAN). Si ambos
   se llaman "factura", el comprador tiene dos facturas de un solo pago y nadie
   —ni él, ni el contador, ni soporte— sabe cuál vale.

El comprobante es un documento comercial legítimo y suficiente para lo que hoy
se necesita: constancia de qué se compró, a quién, cuánto y cuándo.

### Lo que este cambio NO hace, a propósito

- **No desglosa IVA.** El sistema no tiene ningún dato tributario: no hay tarifa
  por producto ni se sabe si el comerciante es responsable de IVA ni si los
  precios cargados lo incluyen. Un desglose inventado es peor que ninguno,
  porque parece un dato. Es insumo del cliente y bloquea también la factura
  electrónica.
- **No emite factura electrónica.** Requiere habilitación DIAN y proveedor
  tecnológico.

## Capabilities

### New Capabilities
- `sales-document`: qué documento se congela al confirmar un pedido, qué dice,
  cuándo se emite, quién puede verlo y cómo se numera.

### Modified Capabilities
- `email-delivery`: el contrato de envío pasa a admitir adjuntos, y cada driver
  (archivo y proveedor) debe entregarlos.

## Impact

- **Esquema**: nuevo modelo `SalesDocument` (uno por pedido, único), con el
  snapshot en JSON. Migración versionada.
- **Código nuevo**: `src/modules/invoicing/` — congelado, render a PDF y acceso.
- **Código tocado**: `src/modules/orders/confirm.ts` (congela dentro de la misma
  transacción), `src/modules/notifications/send.ts` (adjunta), `src/modules/email/`
  (contrato + dos drivers), detalle de pedido en panel y en cuenta del comprador.
- **Dependencia nueva**: `pdf-lib` — JavaScript puro, sin binarios nativos ni
  lectura de fuentes desde disco. Elegido justamente por la lección de `sharp`:
  lo que carga piezas en tiempo de ejecución no sobrevive al empaquetado
  standalone de Next.
- **Respaldo**: nada nuevo que respaldar — el documento vive en la base, que ya
  se respalda; el PDF se re-renderiza desde él.
