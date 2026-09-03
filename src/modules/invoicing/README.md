# Comprobante de pedido

El documento que KORA emite cuando un pedido se confirma. Alcance **nuevo**,
fuera de la cotización: pedido de Daniel el 2 sep 2026.

## Qué es y qué no

Es un **comprobante de pedido**, no una factura electrónica de venta.

En Colombia una "Factura de Venta" numerada exige numeración autorizada por la
DIAN (prefijo y resolución). Pero el argumento decisivo es práctico: **cuando
exista la factura electrónica habrá dos documentos por la misma compra**, con
numeraciones distintas —la nuestra y la de la DIAN—. Si ambos se llaman
"factura", el comprador tiene dos facturas de un solo pago y ni él, ni su
contador, ni soporte pueden decir cuál vale.

La factura electrónica está **anunciada y desactivada** (`lock.ts`), con el
mismo criterio que Email marketing: se enseña qué falta en vez de esconder el
botón, porque los tres insumos son del cliente.

**No desglosa IVA.** El sistema no tiene una sola tarifa cargada ni sabe si el
comerciante es responsable de IVA ni si los precios del catálogo lo incluyen. Un
desglose sobre una tarifa supuesta no es un dato incompleto: es un dato falso
con apariencia de dato, y a diferencia de un campo vacío nadie lo revisa. Es
insumo pendiente del cliente y bloquea también la factura electrónica.

## Las reglas

1. **Se emite dentro de la transacción que confirma** (`freezeSalesDocument`).
   Fuera de ella habría una ventana con un comprobante de un pedido que aún
   podría no confirmarse; y un pedido confirmado sin comprobante **no da ningún
   error**: se descubre el día que alguien lo pide. Hay una prueba que lee el
   código fuente y exige que todo archivo que escriba `status: "CONFIRMED"`
   llame también a `freezeSalesDocument` — hoy `confirmOrder()` es el único
   camino, pero el POS (S9) abrirá otro.
2. **Uno por pedido**, garantizado por el índice único de `orderId`, no por
   leer antes: leer no es reservar.
3. **Se congela el CONTENIDO, no el PDF.** `snapshot` guarda lo que el
   documento dice y el PDF se renderiza cada vez. Guardar los bytes congelaría
   también la maqueta —y con ella cualquier error de diseño— y obligaría a
   inflar la base o a acoplarlo al almacenamiento de imágenes y a su guarda de
   arranque, que cuenta archivos contra la base. **Contrapartida aceptada:**
   rediseñar la maqueta cambia el aspecto de comprobantes viejos; lo que dicen
   no cambia.
4. **El código del pedido se congela** (`KO-2026-08256`). Lo decide el año de
   CREACIÓN, no el de confirmación: un pedido creado el 31 de diciembre y
   confirmado el 1 de enero tendría dos códigos distintos, uno en el panel y
   otro en su comprobante, sin que nada fallara.
5. **Un adjunto nunca impide que salga el correo** (`attachment.ts` no lanza
   nunca). Perder el aviso de que un pago fue confirmado por culpa de un archivo
   sería el mismo error que atar una venta a que salga un correo.
6. **Solo viaja con `BUYER_CONFIRMED`.** Adjuntarlo a cada cambio de estado
   mandaría el mismo documento cuatro veces.
7. **Solo los pedidos que llegaron a venderse tienen comprobante**
   (`CONFIRMED_STATUSES`, la definición única del proyecto).

## `pdf-lib`, y por qué no otra

JavaScript puro: sin binarios nativos, sin leer fuentes del disco. `pdfkit` lee
sus métricas `.afm` del paquete en tiempo de ejecución —el patrón que hundió a
`sharp` tres despliegues seguidos— y cualquier opción con navegador sin cabeza
arrastra Chromium a la imagen.

Por lo mismo, **el logo va como módulo importado en base64** (`logo.ts`), no
leído de `public/`: el rastreo de archivos de Next es estático, y quien renderiza
el comprobante del correo es el **worker**, en su propio contenedor.

⚠️ **`pdf.ts` no puede importar nada de Next**, por esa misma razón.

⚠️ **Los textos se limpian antes de dibujarse** (`limpiar`). Helvetica codifica
WinAnsi y un carácter fuera de ese juego hace **lanzar** a `pdf-lib`. Los
nombres de producto los carga el cliente desde su Excel: un solo `★` tumbaría
el comprobante y, con él, el correo de confirmación.

## Comandos

```bash
pnpm invoice:preview          # un comprobante de ejemplo en .invoices/
pnpm invoice:preview 8256     # el comprobante real de ese pedido
```

Mismo motivo que `pnpm emails:preview`: **el cliente tiene que aprobar el
documento** antes de que salga hacia un comprador, y un PDF no se revisa leyendo
el código que lo dibuja.

## Pendientes del cliente

Ninguno bloquea el comprobante; **todos bloquean la factura electrónica**:

1. ¿KORA es responsable de IVA? ¿Los precios del catálogo lo incluyen?
2. Visto bueno de razón social, NIT y domicilio (`KORA_LEGAL_*`) — el mismo
   pendiente que las páginas legales.
3. Habilitación ante la DIAN y proveedor tecnológico.
