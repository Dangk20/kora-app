## Context

Hoy `src/modules/legal/` tiene tres documentos en español: `terminos`, `datos-personales` y `cambios`. Son datos tipados, fábricas que reciben al comerciante desde `KORA_LEGAL_*`. Se pintan en `src/app/(tienda)/legal/[slug]` con la cabecera y el footer de la tienda. La guarda de arranque (`assertLegalConfiguredOrExit`) impide que producción publique marcadores. Ver proposal.md para el porqué.

Restricciones que dan forma al diseño:

- **La imagen se compila una vez** y corre en pruebas y en producción. Nada que distinga entornos puede quedar grabado en el build, así que no se usan `NEXT_PUBLIC_*` y todo se lee en tiempo de ejecución.
- El **Caddyfile vive en el servidor**: cambiarlo es un paso manual del despliegue.
- El prototipo `Kora.dc.html` no tiene páginas legales. La referencia de maqueta es `legal.twitch.com`, que pidió Daniel, con color y tipografía del manual de KORA.

## Goals / Non-Goals

**Goals:**
- Un solo lugar donde viven todos los documentos, con una sola definición de su URL pública.
- Mantener las tres invariantes de `paginas-legales-y-seo`:
  - datos tipados en el repositorio;
  - las cifras salen de constantes;
  - sin datos de los comercios, producción no arranca.

**Non-Goals:**
- No se construye un CMS ni edición desde el panel.
- No se guarda qué versión aceptó cada comprador.
- No hay diccionario `messages/` para el cuerpo de los documentos: solo el marco (cabecera y navegación) usa i18n.

## Decisions

### 1. El centro legal es una ruta de la misma aplicación, enrutada por host

Se añade la ruta `src/app/(legal)/legal/[idioma]/…`, sin la cabecera ni el footer de la tienda. El marco se monta en cada página (`LegalPage`) y no en un layout, porque necesita saber qué documento está abierto y un layout no recibe ese segmento. `src/middleware.ts` pasa a ser una función que:

1. **En el host legal** (el de `KORA_LEGAL_URL`) reescribe `/<ruta>` a `/legal/<ruta>`, y la raíz `/` a `/legal`. Todo lo que no sea `<idioma>/<doc>` cae en el 404 de esa ruta. Así el subdominio nunca sirve la tienda ni el panel.
2. **En cualquier otro host** convierte `/legal/<slug>` (el formato antiguo, sin idioma) en una redirección 301 al documento en español. El destino es el subdominio si está configurado, o `/legal/es/<slug>` si no.
3. **En `/admin` y `/pos`** delega en el `auth` de NextAuth, igual que hoy.

El middleware declara `runtime: "nodejs"` (estable en Next 15.5) para leer `KORA_LEGAL_URL` del proceso en tiempo de ejecución. Su matcher excluye `/_next/*`, `/media/*` y `/api/*`.

*Alternativas descartadas:*
- **Una aplicación aparte:** duplicaría el despliegue para siete páginas.
- **Reescribir en Caddy:** funcionaría, pero deja la regla fuera del repositorio y sin prueba. Además los recursos `/_next/*` habría que excluirlos a mano.

### 2. Una sola definición de la URL pública: `legalUrl(idioma, slug?, ancla?)`

Vive en `src/modules/legal/url.ts`.
- Con `KORA_LEGAL_URL` (por ejemplo `https://legal.korashopp.com`) devuelve `https://legal.korashopp.com/en/terminos`.
- Sin ella devuelve `/legal/en/terminos`, lo que permite que desarrollo y pruebas funcionen sin DNS.

La consumen el footer, el menú móvil (recibe las URL ya resueltas como props, porque es un componente cliente), el checkout, los correos y el sitemap. Es el mismo patrón que `storeUrl()`.

El selector de idioma y la navegación interna del centro usan rutas relativas al host en el que están. El middleware decide qué host es cuál: en el subdominio, `/en/terminos`; fuera de él, `/legal/en/terminos`. Para eso la página compara el `Host` de la petición con el de `KORA_LEGAL_URL` (`esHostLegal`), la misma función que usa el middleware.

### 3. Contenido bilingüe: un documento = una fábrica por idioma, con secciones identificadas

`LegalDocument` gana `id` por sección (el ancla, igual en los dos idiomas) y `summary` opcional por sección (el recuadro destacado). Cada documento exporta `{ es: Factory, en: Factory }`.

Una prueba compara las dos versiones y exige mismos slugs, mismas secciones en el mismo orden y mismos `id`. Es el equivalente de `typeof es` en los diccionarios: una sección sin traducir no pasa el CI.

La regla de no recibir ni guardar datos de tarjeta también se fija por prueba, sobre el texto de los dos idiomas.

### 4. Datos de los dos comercios

Al `Merchant` actual (KORA SHOPP S.A.S.) se le añade `llc: { razonSocial, registro, domicilio }`, leído de tres variables:
- `KORA_LEGAL_LLC_RAZON_SOCIAL`
- `KORA_LEGAL_LLC_REGISTRO` (UBI y estado)
- `KORA_LEGAL_LLC_DOMICILIO`

Se suma `KORA_LEGAL_MATRICULA`, el registro mercantil de la S.A.S.: KORA opera en dos países y se publican los registros de cada sociedad. La LLC es la matriz (Daniel, 10 oct). La S.A.S. se presenta como «su sociedad en Colombia» y no como «sucursal», porque en derecho colombiano una sucursal de sociedad extranjera no tiene NIT propio y la S.A.S. sí.

Las tres entran en `LEGAL_REQUIRED_VARS`, así que heredan la guarda de arranque y los marcadores sin código nuevo.

El teléfono de atención es el WhatsApp de pedidos que ya existe en el código. No se crea una segunda definición.

### 5. Monedas y marcas: constantes, no texto

- `MONEDAS_TARJETA` va en `src/modules/legal/payments.ts` y la leen los textos.
- `MARCAS_ACEPTADAS` es la lista de marcas con su logotipo SVG oficial a todo color, guardado en `public/marcas/`: Visa, Mastercard y American Express (Daniel confirmó Amex el 10 oct).
- `MEDIOS_TRANSFERENCIA` son las transferencias que se coordinan por WhatsApp, con su país y su moneda: Nequi y Bre-B en Colombia, Zelle en EE.UU. El sello de Bre-B está pendiente (Manual de Identidad del Banco de la República) y mientras tanto se muestra el nombre.

Así, el día que cambie lo contratado, el texto y los logotipos cambian juntos.

### 6. Maqueta

- **Cabecera:** franja negra como el header de la tienda (`#16181D`, pedido de Daniel), el logotipo de KORA más «legal» en Allura coral, y dos botones: «Idioma» (desplegable es/en) y «Volver a KORA ↗».
- **Debajo, tres columnas en escritorio:**
  - lateral izquierdo con la lista de documentos sobre un neutro claro, con el actual marcado;
  - documento central en la tipografía del manual;
  - índice «En esta página» pegajoso a la derecha.
- **El resumen de cada sección** va en un recuadro con tinte coral claro y un ícono, en lugar del morado de Twitch.
- **En móvil** la lista de documentos pasa a un desplegable bajo la cabecera y el índice se oculta.
- **El índice del centro** son tarjetas, una por documento, con su resumen.

### 7. Footer de la tienda: componente propio, datos de una sola fuente

El footer sale de `(tienda)/layout.tsx` y pasa a `src/modules/storefront/footer/` como componente de servidor. Las referencias son los footers de Claro y de Seguros Mundial que mandó Daniel; color y tipografía son los del manual. Conserva el fondo `#0E0F12` y los grises del footer actual, para no romper la continuidad con el prototipo.

**Fila superior**, en una rejilla de cuatro columnas en escritorio:
- logotipo y lema;
- columnas Tienda, Ayuda y Legal;
- bloque «Medios de pago», con los logotipos de `MARCAS_ACEPTADAS` sobre una pastilla blanca para que los colores de marca se lean sobre el fondo oscuro, más la línea «Otros medios: coordínalos por WhatsApp»;
- bloque de contacto con WhatsApp, teléfono y correo escritos, y las redes sociales.

**Franja inferior**, separada por un filete: a la izquierda el aviso de derechos y la firma; a la derecha la identificación de los dos comercios, como en la referencia de Claro.

**Fuentes de los datos:**
- Razón social, NIT, domicilio y correo salen de `merchant()`. El WhatsApp sale de la constante que ya existe.
- Las redes salen de `KORA_SOCIAL_*`, que son opcionales: una red sin dirección no se pinta.
- Los enlaces legales salen de `legalUrl()` en el idioma activo.

**Móvil:** las columnas se apilan y las de enlaces pasan a acordeón para no alargar la página. El footer añade el relleno de la barra inferior (`env(safe-area-inset-bottom)` más su altura), como ya hacen las páginas con barra de compra.

Los textos del marco van en `messages/es|en/layout.ts`. Los datos del comercio no se traducen: «S.A.S.», el NIT y la dirección se publican igual en los dos idiomas.

*Alternativa descartada:* poner la identificación solo en el centro legal. El banco revisa el sitio que el comprador usa al pagar, y una dirección escondida a dos clics no cuenta como «exhibida».

### 8. Lo que no cambia

- No hay migración Prisma.
- No se emiten ni consumen eventos.
- Las páginas siguen siendo `force-dynamic`, por la misma razón de siempre: interpolan datos del entorno.
- `robots: { index: false, follow: true }` se conserva.
- `RUTAS_PRIVADAS` sigue vigente para el host de la tienda. El host legal recibe un `robots.txt` que permite el rastreo, porque el banco tiene que poder llegar.

## Risks / Trade-offs

- **[Riesgo] El DNS o el Caddyfile no se aplican y la tienda enlaza a un subdominio muerto.** → `KORA_LEGAL_URL` se pone en `.env.production` **después** de verificar que `legal.korashopp.com` responde. Mientras no está, todo funciona bajo `/legal/<idioma>/…` del dominio principal. El orden va en `deploy/README.md`.
- **[Riesgo] El middleware se ejecuta ahora en todas las rutas públicas.** → Hace una comparación de host y una de prefijo, sin acceso a la base. NextAuth solo se invoca en `/admin` y `/pos`, como hoy.
- **[Riesgo] Producción no arranca hasta tener los datos de la LLC.** Es deliberado, mismo criterio que la S.A.S. Se anuncia en la propuesta como bloqueo y el mensaje de arranque nombra la variable.
- **[Contrapartida] Textos que describen el pago con tarjeta antes de que el checkout lo ofrezca.** → Se redactan en condicional («cuando eliges pagar con tarjeta…»), así que son ciertos el día de su publicación. El change del pago alojado no tendrá que reescribirlos.
- **[Contrapartida] Traducción hecha por el equipo, no por un traductor jurídico.** → La versión en inglés dice que prevalece la española. La revisión legal es del cliente.

## Migration Plan

1. Integrar a `main`. Pruebas despliega solo y sirve el centro en `test.korashopp.com/legal/es/…`.
2. Daniel:
   - crea el registro `A legal → 2.24.90.21` en Hostinger;
   - añade al Caddyfile del servidor el bloque `legal.korashopp.com` (está versionado en `deploy/Caddyfile`) y recarga Caddy;
   - escribe en `.env.production` los `KORA_LEGAL_*` de la S.A.S., los `KORA_LEGAL_LLC_*` y `KORA_LEGAL_URL=https://legal.korashopp.com`;
   - lanza el despliegue de producción.
3. Comprobar con `curl -I https://korashopp.com/legal/terminos` que responde 301 al subdominio, y que `https://legal.korashopp.com/es/terminos` responde 200.
4. Responder al banco con la dirección del centro legal.

**Reversión:** quitar `KORA_LEGAL_URL` devuelve todo al dominio principal sin desplegar código. La redirección antigua sigue funcionando sin subdominio.
