## 1. Módulo legal: configuración y guarda de arranque

- [x] 1.1 Crear `src/modules/legal/config.ts` con la lista única de variables obligatorias del comerciante (razón social, NIT, domicilio, correo de atención al titular), `missingLegalVars()`, `LegalConfigError` y `merchant()` que devuelve los datos con marcadores explícitos en desarrollo. Calcar el patrón y los comentarios de `src/modules/storage/config.ts`.
- [x] 1.2 Añadir `assertLegalConfiguredOrExit()` y engancharlo en `src/instrumentation.ts` junto a la comprobación de almacenamiento, con la misma nota de por qué el `process.exit` vive en el módulo y no en el gancho.
- [x] 1.3 Añadir las cuatro variables a `.env.example` y a `deploy/README.md` (sección de variables por entorno), marcadas como **bloqueo de arranque en producción**.
- [x] 1.4 Tests: producción sin cada variable → error con el nombre de la que falta; producción completa → sin error; desarrollo vacío → sin error y con marcadores visibles.

## 2. Contenido de las tres políticas

- [x] 2.1 Definir el tipo del contenido legal (documento con slug, título, fecha de actualización y secciones de título + párrafos) en `src/modules/legal/content/types.ts`, con los datos del comerciante interpolados en el render y nunca escritos en el texto.
- [x] 2.2 Escribir `datos-personales.ts`: responsable del tratamiento, finalidades reales del sistema (gestionar el pedido, contactar por WhatsApp, acreditar cashback, enviar comprobantes, y marketing **solo con opt-in separado**), derechos del titular, canal y plazos de respuesta, trazado a Ley 1581/2012 y Decreto 1377/2013.
- [x] 2.3 Escribir `terminos.ts`: **sin pasarela de pago** (cobro por WhatsApp fuera de la plataforma), vigencia del pedido **importada de la constante real** de `src/modules/orders/`, disponibilidad sujeta a confirmación, doble moneda con precio propio por divisa sin conversión, y reglas de Kora Cashback. Sin promesas comerciales que el negocio no sostiene.
- [x] 2.4 Escribir `cambios.ts`: política del cliente (30 días calendario, producto nuevo, etiquetas y empaque) en una sección, y en secciones **separadas** el derecho de retracto de 5 días hábiles (Ley 1480/2011 art. 47) y la garantía legal (arts. 7–8), sin condicionarlos a la política comercial y sin ninguna negación absoluta de devolución de dinero.
- [x] 2.5 Test de contenido: falla si `cambios` omite retracto o garantía legal, si aparece una negación absoluta de devolución, o si el plazo de vigencia publicado en `terminos` no coincide con la constante del módulo de pedidos.

## 3. Rutas y enlaces en la tienda

- [x] 3.1 Crear `src/app/(tienda)/legal/[slug]/page.tsx` con `generateStaticParams` sobre los tres slugs, `notFound()` para cualquier otro, `generateMetadata` por documento, y un único componente de render con el contenedor y la tipografía del resto de la tienda.
- [x] 3.2 Añadir al footer de `src/app/(tienda)/layout.tsx` los tres enlaces legales, sin romper el layout actual del footer en escritorio ni en móvil.
- [x] 3.3 Enlazar la política de datos desde el texto del consentimiento en `checkout-view.tsx` (`target="_blank"` + `rel="noopener noreferrer"`, para no perder el formulario en curso), dejando la casilla igual de obligatoria que ahora.
- [x] 3.4 Verificar a mano: las tres páginas responden, `/legal/inventada` da 404, y abrir la política desde el checkout con el formulario a medio llenar no pierde los datos ni el carrito.

## 4. SEO: robots y sitemap

- [x] 4.1 Crear `src/app/robots.ts`: permite la tienda pública y bloquea `/admin`, `/login`, `/cuenta`, `/carrito`, `/checkout`, `/suscripcion`, `/media` y `/api`; declara el sitemap. **Prohíbe todo salvo en producción real**, usando `esProduccion()` de `src/lib/environment.ts` — corregido durante la implementación: `KORA_ENV` ausente ES producción (ver design, decisión 4). Va `force-dynamic` o se congela en el build.
- [x] 4.2 Crear `src/app/sitemap.ts` usando las consultas de `src/modules/storefront/queries.ts` —nunca un `where` propio—: estáticas (home, catálogo, las tres legales), categorías con productos y productos publicados, con `lastModified` real.
- [x] 4.3 Tests: la lista de rutas privadas está cubierta por las reglas de bloqueo; `KORA_ENV` distinto de producción prohíbe todo; el sitemap no contiene ninguna URL bajo rutas privadas; un producto despublicado desaparece del sitemap.

## 5. Metadata para compartir

- [x] 5.1 Añadir `openGraph`/`twitter` a la metadata de home y catálogo, con la URL absoluta desde `NEXT_PUBLIC_STORE_URL`.
- [x] 5.2 Extender `generateMetadata` de `producto/[slug]`: título con el nombre del producto, descripción del producto e imagen principal; logo de marca como respaldo cuando el producto aún no tiene fotos. Sin calcular precios fuera de `resolvePrice()`.
- [x] 5.3 Verificar la vista previa de un enlace de producto con y sin imagen.

## 6. Cierre

- [x] 6.1 Registrar en `../notas-tecnicas-privado.md`: el conflicto legal de §6 de las reglas del cliente y que la redacción queda **pendiente de su visto bueno**; la deuda de no versionar la política aceptada por pedido; y que las páginas legales son alcance nuevo fuera de la cotización.
- [x] 6.2 Preparar el texto de las tres páginas en un formato que Daniel pueda mandarle al cliente para aprobación, junto con la petición de razón social, NIT, domicilio y correo de atención.
- [x] 6.3 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde, y actualizar `../bitacora-sprints-kora.md` con el bloque cerrado y el bloqueo abierto.
