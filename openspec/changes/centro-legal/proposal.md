## Why

**Semana del plan:** ninguna. Es **alcance NUEVO, fuera de la cotización** y sin HU. Ocurre en la semana 14 del calendario (10–16 oct 2026). Lo dispara un requisito externo con fecha: Bank of America, que abrió la cuenta comercial de la LLC para el **pago alojado con tarjeta**, revisó `korashopp.com` y exige que en **30 días** el sitio cumpla las normas de las redes de tarjetas (Visa, Mastercard, American Express OptBlue). Si no se cumple, el banco retrasa el procesamiento o cierra la cuenta.

Lo publicado hoy no aprueba esa revisión:

- Producción todavía muestra al comerciante como persona natural.
- Los términos dicen literalmente *«no cobramos en línea»*, lo opuesto a un comercio que acaba de habilitar cobro con tarjeta.
- Faltan cuatro piezas que el banco pide por nombre:
  - política de entrega
  - seguridad en la transmisión de datos de tarjeta
  - condiciones de las promociones
  - logotipos de las marcas aceptadas
- Los documentos solo están en español, y quien revisa es un banco de EE.UU.

Daniel decidió además reunir todo lo legal en **un solo lugar, `legal.korashopp.com`**, con la maqueta de un centro legal (referencia: `legal.twitch.com`).

## What Changes

- **Centro legal en `legal.korashopp.com`.**
  - Cabecera de marca con selector de idioma y «Volver a KORA».
  - A la izquierda, la lista de todos los documentos.
  - Al centro, el documento con un resumen destacado bajo cada sección.
  - A la derecha, el índice «En esta página».
  - Página de inicio con todos los documentos.
- **Migración completa.** `korashopp.com/legal/*` redirige de forma permanente (301) a su documento en el subdominio. El footer, el menú móvil, el checkout, los correos y el sitemap apuntan al subdominio. **BREAKING** para cualquier enlace guardado a `/legal/*`; la redirección lo absorbe.
- **Bilingüe es/en.** Cada documento existe en los dos idiomas y la versión en español prevalece en Colombia. Desaparece la etiqueta «(Spanish)» del footer en inglés.
- **Documentos.** De siete, tres se actualizan y cuatro son nuevos. Cada uno cubre un punto de la lista del banco:
  1. *Términos y condiciones de venta* (actualizado): dos vías de pago (tarjeta en la página segura del procesador, u otro medio coordinado por WhatsApp), comercio que cobra la tarjeta, monedas, restricciones legales y de exportación.
  2. *Política de privacidad y tratamiento de datos* (actualizado): datos de tarjeta capturados por el procesador, nunca por KORA.
  3. *Cambios, devoluciones y reembolsos* (actualizado): el reembolso de un pago con tarjeta vuelve a la misma tarjeta.
  4. *Política de envíos y entrega* (nuevo): entrega solo en Colombia, tiempos, costos y quién recibe.
  5. *Seguridad de pagos* (nuevo): página alojada, cifrado y PCI DSS del procesador; KORA no ve ni guarda números de tarjeta.
  6. *Promociones, cupones y Kora Cashback* (nuevo): reglas generales y las promociones vigentes.
  7. *Información del comercio y contacto* (nuevo): las dos sociedades, sus direcciones físicas y países, correo, WhatsApp y canal de PQR.
- **Datos de la LLC** como nuevas variables `KORA_LEGAL_LLC_*`, con la misma guarda de arranque que los datos de la S.A.S.: producción no arranca con marcadores.
- **Logotipos de las marcas aceptadas, a todo color**, en el footer de la tienda y en el centro legal.
- **Rediseño del footer de la tienda.** Se toman como referencia los footers de Claro y de Seguros Mundial, que Daniel pidió.
  - Columnas de enlaces: Tienda, Ayuda y Legal.
  - Bloque «Medios de pago» con las tarjetas (Visa, Mastercard, American Express), las transferencias de Colombia (Nequi, Bre-B) y la de EE.UU. (Zelle), por país y moneda.
  - Bloque de contacto: WhatsApp, teléfono y correo.
  - Redes sociales.
  - Una franja inferior que identifica al comercio: razón social, NIT, dirección, país, teléfono y correo de las dos sociedades, con los enlaces al centro legal.

  Así se cumple, en todas las páginas, lo que el banco pide ver en el sitio y no solo en un documento. Se aparta a propósito del footer del prototipo aprobado, que es una sola franja con logotipo y tres enlaces.

## Capabilities

### New Capabilities
- `legal-center`: el centro legal en su subdominio, con navegación, idiomas, el juego completo de documentos, la redirección desde las rutas antiguas, la identidad de los dos comercios y la información que el sitio entero debe exhibir según las redes de tarjetas. Esa información sale en el footer de la tienda: medios de pago, contacto e identificación del comercio.

### Modified Capabilities
_Ninguna publicada._ La capacidad `legal-pages` vive en el change sin archivar `paginas-legales-y-seo`. Este change la reemplaza en cuanto a dirección y conjunto de documentos, y conserva sus invariantes: el retracto y la garantía no se niegan, producción no arranca sin los datos del comerciante y el contenido es datos tipados en el repositorio.

## Impact

- **Código:** `src/modules/legal/` (contenido bilingüe, configuración de la LLC, URL pública), una ruta nueva para el centro legal, `src/middleware.ts` (enrutado por host y redirección), footer rediseñado como componente propio en `src/modules/storefront/` (escritorio y móvil), menú móvil, checkout, plantilla de correo, `sitemap.ts`/`robots.ts`, pruebas de contenido legal.
- **Infraestructura:**
  - un bloque nuevo en `deploy/Caddyfile` para `legal.korashopp.com`;
  - un registro DNS `A legal → 2.24.90.21` en Hostinger, que lo crea Daniel;
  - variables nuevas en `.env.production`.
- **Sin migración Prisma.** No emite ni consume eventos de `domain_events`.

### Insumos

**Resueltos el 10 oct (Daniel):**
- La LLC es KORA SHOPPING LLC, de Washington (UBI 606212090), y es la matriz.
- La tarjeta cobra en USD y en COP.
- Se acepta American Express.
- Las transferencias aceptadas son Nequi y Bre-B en Colombia, y Zelle en EE.UU.

**Pendientes:**
- **DNS** `legal.korashopp.com`, y volver a desplegar producción con las ocho `KORA_LEGAL_*`. Lo hace Daniel.
- **Sello oficial de Bre-B**: el Manual de Identidad del Banco de la República no se deja descargar en automático. Mientras no esté, se muestra el nombre.
- **Direcciones de las redes sociales.** Solo se muestra una red con dirección confirmada, nunca un ícono que lleve a ninguna parte.
- **Confirmar «matriz» y «filial».** Si la LLC es dueña de las acciones de la S.A.S., el término exacto es «filial» o «subsidiaria». Hoy se escribe «su sociedad en Colombia», que es cierto en cualquier caso.

## Fuera de alcance

- **La integración del pago alojado en sí**: el selector de medio de pago en el checkout, la redirección a la página del banco, el webhook y la confirmación automática. Es el siguiente change; aquí solo se publican las políticas que lo describen.
- **Las descripciones completas de cada producto**, que el banco también pide. Es contenido de catálogo y lo carga el cliente.
- Asesoría jurídica: los textos los redacta el equipo técnico a partir de la ley citada y de las decisiones del cliente. La revisión legal es del cliente.
- Versionado de qué texto aceptó cada comprador, y página de «versiones anteriores» como la de Twitch.
- Traducir al inglés el resto de lo que sigue en español a propósito: panel, correos, comprobante y WhatsApp.
