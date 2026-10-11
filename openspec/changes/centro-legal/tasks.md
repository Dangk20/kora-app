## 1. Modelo y configuración

- [x] 1.1 `types.ts`: secciones con `id` (ancla) y `summary` opcional; documento bilingüe `{ es, en }`; slugs de los siete documentos
- [x] 1.2 `config.ts`: datos de la LLC (`KORA_LEGAL_LLC_*`) dentro de `LEGAL_REQUIRED_VARS`, con marcadores y guarda de arranque
- [x] 1.3 `payments.ts`: `MONEDAS_TARJETA` (COP y USD), `MARCAS_ACEPTADAS` (Visa, Mastercard, Amex) y `MEDIOS_TRANSFERENCIA` (Nequi, Bre-B, Zelle) con sus logotipos en `public/marcas/`
- [x] 1.4 `url.ts`: `legalUrl(idioma, slug?, ancla?)` como única definición de la dirección pública

## 2. Contenido (es + en)

- [x] 2.1 Términos y condiciones de venta: dos vías de pago, comercio que cobra la tarjeta, monedas, restricciones legales y de exportación
- [x] 2.2 Privacidad y tratamiento de datos: los datos de tarjeta los captura el procesador; encargados del tratamiento
- [x] 2.3 Cambios, devoluciones y reembolsos: reembolso a la misma tarjeta; conserva retracto y garantía
- [x] 2.4 Envíos y entrega (nuevo)
- [x] 2.5 Seguridad de pagos (nuevo)
- [x] 2.6 Promociones, cupones y Kora Cashback (nuevo), con el cupón de bienvenida tomado de su constante
- [x] 2.7 Información del comercio y contacto (nuevo)

## 3. Centro legal

- [x] 3.1 Ruta `(legal)/legal/[idioma]` (índice) y `[idioma]/[slug]` (documento), con 404 para lo desconocido
- [x] 3.2 Maqueta: cabecera de marca con idioma y «Volver a KORA», lista de documentos, resúmenes destacados, índice «En esta página», versión móvil
- [x] 3.3 `middleware.ts`: reescritura en el host legal, 301 desde `/legal/<slug>` y NextAuth solo en `/admin` y `/pos`
- [x] 3.4 `robots.txt` y sitemap según el host

## 4. Tienda

- [x] 4.1 Footer nuevo en `storefront/footer/`: columnas Tienda, Ayuda y Legal, con textos del marco en `messages/es|en/layout.ts`
- [x] 4.2 Bloque «Medios de pago» (logotipos de `MARCAS_ACEPTADAS` + línea de WhatsApp) y bloque de contacto con redes desde `KORA_SOCIAL_*` (opcionales)
- [x] 4.3 Franja inferior de identificación de los dos comercios desde `merchant()`, más el aviso de derechos y la firma
- [x] 4.4 Footer en móvil: apilado, acordeón de enlaces y relleno de la barra inferior; comprobado a 390 px sin desbordes
- [x] 4.5 Menú móvil con `legalUrl` en el idioma de la tienda, sin la etiqueta «(Spanish)»
- [x] 4.6 Checkout, correos y comprobante enlazan al centro legal
- [x] 4.7 Borrar la ruta antigua `(tienda)/legal/[slug]`

## 5. Despliegue

- [x] 5.1 Bloque `legal.korashopp.com` en `deploy/Caddyfile`; `KORA_LEGAL_URL`, `KORA_LEGAL_LLC_*` y `KORA_SOCIAL_*` en las plantillas `.env*`; orden de pasos en `deploy/README.md`

## 6. Pruebas y cierre

- [x] 6.1 Pruebas: paridad es/en, puntos de la lista del banco, ninguna negación de cobro en línea, no se reciben datos de tarjeta, guarda de la LLC, `legalUrl` con y sin subdominio, enrutado y 301 del middleware, y que el footer contenga la identificación del comercio y oculte las redes sin dirección
- [x] 6.2 Actualizar `tests/legal-content.test.ts` y `tests/legal.test.ts` al nuevo modelo
- [x] 6.3 Notas privadas, bitácora y CLAUDE.md (alcance nuevo declarado)
- [x] 6.4 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde
