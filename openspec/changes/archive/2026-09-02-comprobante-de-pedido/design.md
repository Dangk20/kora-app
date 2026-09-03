## Context

El pago de KORA ocurre **fuera de la plataforma**: el comprador crea el pedido,
se va a WhatsApp y paga por el canal que acuerde con el operador. La plataforma
no ve el dinero. Su único acto de autoridad sobre la venta es
`confirmOrder()` — el evento central del sistema, del que ya cuelgan el
descuento de stock, el cashback y los correos.

El comprobante cuelga de ese mismo acto. No hay ningún otro momento en el que la
plataforma sepa que una venta ocurrió.

## Goals / Non-Goals

**Goals**
- Un documento por pedido confirmado, congelado, verificable años después.
- Que llegue solo, sin que el comprador tenga que pedirlo.
- Que el camino a la factura electrónica quede abierto y anunciado.

**Non-Goals**
- Facturación electrónica DIAN (habilitación, CUFE, proveedor tecnológico).
- Cálculo de impuestos. El sistema no tiene ni un dato tributario.
- Numeración fiscal sin huecos.

## Decisions

### 1. Se congela el CONTENIDO, no el PDF

El comprobante guarda un snapshot en JSON (comerciante, comprador, entrega,
líneas, totales) y el PDF **se renderiza cada vez que alguien lo pide**.

La alternativa era guardar los bytes del PDF. Se descartó:

- El PDF es una *presentación* del documento; lo que tiene que ser inmutable es
  lo que **dice**. Guardar bytes congela también la maqueta, y con ella cualquier
  error de diseño, para siempre.
- Guardar bytes obliga a elegir dónde: en la base la infla (decenas de KB por
  pedido, y el volcado de respaldo es lo que tiene que funcionar cuando nada más
  funciona), y en el almacenamiento de archivos lo acopla al driver de imágenes
  y a su guarda de arranque, que cuenta archivos contra la base y vería PDFs
  donde espera fotos.
- Con snapshot en la base, el respaldo ya cubre el comprobante sin tocar nada.

**Contrapartida aceptada y anotada:** si mañana se rediseña la maqueta, el PDF
que el comprador descargue del panel no será byte a byte el que recibió por
correo. Dirá lo mismo —eso está garantizado por el snapshot—, pero no se verá
igual. Es el precio de no congelar la presentación, y se paga a sabiendas.

### 2. `pdf-lib`, y por qué no otra

JavaScript puro: sin binarios nativos, sin descargar fuentes en tiempo de
ejecución, sin leer archivos del disco para funcionar. Es exactamente lo que
`sharp` **no** es, y esa lección costó tres despliegues: el rastreo de archivos
de Next es estático, y lo que una librería carga dinámicamente no viaja en la
salida standalone.

Descartadas: `pdfkit` (lee sus métricas de fuente `.afm` del paquete en tiempo
de ejecución — mismo patrón que hundió a `sharp`), y cualquier cosa basada en un
navegador sin cabeza (arrastra Chromium a la imagen).

La tipografía del comprobante es Helvetica, la estándar del formato PDF, que va
dentro del propio visor. La marca entra por el **logo** (`logo-kora-negro.png`,
que ya está en el repositorio) y por el **color** de los tokens, no por la
fuente. Embeber Manrope exigiría meter los bytes de la fuente como módulo
importado —por la misma razón por la que la tabla de geolocalización es un `.ts`
y no un archivo de datos—, y no vale ~200 KB en la imagen para un documento que
se imprime.

### 3. El congelado va DENTRO de la transacción de confirmación

`freezeSalesDocument(tx, orderId)` se llama desde el mismo `$transaction` que
descuenta stock, cambia el estado y escribe el evento. No después.

Fuera de ella existiría una ventana con un comprobante de un pedido que todavía
podría no confirmarse. **Y al revés:** un pedido confirmado sin comprobante es
peor, porque no da ningún error — se descubre el día que alguien lo pide.

Como hoy `confirmOrder()` es el único camino a `CONFIRMED` pero el POS (S9) va a
abrir otro, esto se fija con una **prueba que lee el código fuente**: todo
archivo que escriba `status: "CONFIRMED"` tiene que llamar también a
`freezeSalesDocument`. Es el mismo tipo de prueba que impide que
`createOrder()` importe el módulo de envío.

### 4. La numeración es la del pedido

Sin numeración propia. Una segunda serie solo se justificaría si fuera fiscal y
sin huecos, y la fiscal la asignará la DIAN. Mientras tanto, dos números para
una misma compra solo crean la pregunta de por cuál buscar — y un consecutivo
propio dentro de la transacción de confirmación añadiría un punto de contención
justo donde ya hay bloqueos de stock.

Habrá huecos (solo los pedidos confirmados tienen comprobante) y está bien: es
un documento comercial, no fiscal.

### 5. Un adjunto NUNCA puede impedir que salga el correo

`EmailMessage` gana `attachments?`. El PDF se genera al armar el mensaje del
correo de confirmación, y **si esa generación falla, el correo sale igual, sin
adjunto**, y el fallo se registra.

Es la regla que ya gobierna el módulo: crear un pedido no depende de que salga
un correo, porque perder una venta por un correo caído es cambiar un problema
pequeño por el peor. Aquí es lo mismo un nivel más abajo — perder el aviso de
que un pago fue confirmado por culpa de un adjunto sería el mismo error.

El driver de archivo escribe el PDF **junto al `.html`** en `.emails/`. Un
adjunto que solo se registra no se puede revisar; escrito, se abre y se lee, que
es la misma razón por la que los correos de desarrollo se escriben a disco.

### 6. Quién puede verlo

- **Panel**: `requirePermission("orders:view")`, contra la base, como toda
  acción protegida.
- **Cuenta del comprador**: el `customerId` va **en el `where`**, no en una
  comprobación posterior. Es la regla de todo el módulo de cuenta.

### 7. La factura electrónica se cierra como se cerró Email marketing

Un módulo `invoicing/lock.ts` con el mismo patrón: el botón existe, está
desactivado, dice "Muy pronto" y **explica qué falta** (habilitación ante la
DIAN, proveedor tecnológico, y los datos tributarios). No se esconde: el cliente
sabe así exactamente qué insumo depende de él.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| El documento no desglosa IVA y el contador del cliente lo pide | Está declarado en el propio documento y es insumo pendiente del cliente; sin tarifas cargadas, inventarlo sería peor |
| Los datos del comerciante hoy pueden ser marcadores (`[NIT PENDIENTE]`) | Producción **ya no arranca** sin `KORA_LEGAL_*`; el riesgo real es solo en desarrollo |
| Rediseñar la maqueta cambia el aspecto de comprobantes viejos | Aceptado y anotado en la decisión 1: el contenido no cambia |
| Un pedido confirmado antes de este cambio no tiene comprobante | Se emite al vuelo la primera vez que se pide, con la fecha de confirmación real — ver plan de migración |

## Migration Plan

La migración crea la tabla vacía. **No se rellena hacia atrás en el despliegue**:
los pedidos confirmados anteriores (16 en pruebas, ninguno en producción con
comprador real) no tienen comprobante, y generarlos en masa escribiría
documentos que nadie pidió con los datos del comerciante de hoy.

En su lugar, pedir el comprobante de un pedido confirmado que no lo tiene **lo
emite en ese momento**, fechado con la confirmación real del pedido. Un pedido
viejo solo produce documento si alguien lo necesita.

## Open Questions

Insumos del cliente, ninguno bloquea este cambio pero **todos bloquean la
factura electrónica**:

1. ¿KORA es responsable de IVA? ¿Los precios cargados en el catálogo lo
   incluyen? Sin esto no hay desglose posible, ni aquí ni en la factura DIAN.
2. Confirmación de razón social, NIT y domicilio (hoy en `KORA_LEGAL_*`, sin
   visto bueno del cliente — el mismo pendiente que las páginas legales).
3. ¿Ya hay habilitación ante la DIAN y proveedor tecnológico elegido?
