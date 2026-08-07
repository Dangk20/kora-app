## Context

Ver `proposal.md` — Why. Lo que importa para el diseño es el estado actual:

- El footer de la tienda (`src/app/(tienda)/layout.tsx:140-166`) tiene solo dos enlaces: WhatsApp y acceso del equipo.
- El consentimiento vive inline en `checkout-view.tsx:376-394`, sin enlaces.
- No existe `src/app/robots.ts` ni `src/app/sitemap.ts` — el directorio se comprobó, está limpio.
- El `noindex` de staging vive **solo** en `deploy/Caddyfile:45`, como cabecera `X-Robots-Tag` del borde.
- Ya existe un patrón resuelto para "configuración obligatoria en producción": `src/modules/storage/config.ts` + `src/instrumentation.ts`, escrito precisamente porque la comprobación perezosa dejaba arrancar un contenedor roto. Aquí el problema es el mismo con otra cara.
- El prototipo aprobado `Kora.dc.html` **no tiene páginas legales**. No hay sección equivalente que replicar; se siguen sus patrones de tipografía y contenedor (`max-w-[1320px]`, tarjeta blanca `rounded-[18px]` sobre fondo `#F5F3F0`) como en el resto de la tienda.

## Goals / Non-Goals

**Goals**

- Que las tres páginas legales sean contenido versionado en el repositorio, revisable en un diff, y no filas de una tabla que alguien edite en caliente sin dejar rastro.
- Que sea **imposible** publicar producción con los datos del comerciante sin llenar.
- Que el sitemap no pueda desincronizarse del catálogo.
- Que el `noindex` de staging deje de depender de una sola línea de configuración del proxy.

**Non-Goals**

- Un editor de textos legales en el panel. El operador no debe poder cambiar una política sin que quede rastro ni revisión.
- Versionado histórico de políticas ("versión vigente al momento de tu compra"). Es lo correcto a largo plazo, pero exige guardar la versión aceptada en cada pedido y no hay tiempo antes del 10 ago. Se anota como deuda.
- Internacionalización. La tienda vende en EE.UU. en USD pero opera en español; traducir las legales es una decisión comercial que nadie ha tomado.

## Decisions

### 1. El contenido legal vive en el repositorio como datos tipados, no en la base ni en Markdown suelto

Las tres páginas se escriben como estructuras de datos en `src/modules/legal/content/` (secciones con título y párrafos), y un único componente las renderiza.

**Por qué y no las alternativas:**
- *Markdown en `content/*.md` con un renderizador* — añade una dependencia de parseo y, sobre todo, deja el contenido fuera del sistema de tipos: no se puede escribir una prueba que compruebe que la página de cambios menciona el retracto sin volver a parsear texto. Con datos tipados esa prueba es una línea.
- *Tabla en la base editable desde el panel* — es lo que pediría un CMS, y es justamente lo que no queremos: un cambio en una política sin revisión, sin diff y sin fecha es un riesgo legal mayor que la incomodidad de un despliegue.
- Los datos del comerciante se **interpolan** en el render, no se escriben en el texto. Así el mismo contenido sirve a dev (con marcadores) y a producción (con datos reales) sin duplicar.

### 2. La lógica vive en `src/modules/legal/`, y las rutas de `src/app/` quedan delgadas

Siguiendo la regla 6 del proyecto:

```
src/modules/legal/
  config.ts       # datos del comerciante + comprobación de arranque (calco de storage/config.ts)
  content/        # las tres políticas como datos
  index.ts
```

La ruta es una sola: `src/app/(tienda)/legal/[slug]/page.tsx`, con `generateStaticParams` sobre los tres slugs conocidos. Un slug desconocido llama a `notFound()` — que es lo que exige el escenario de 404 en la spec. Tres archivos `page.tsx` casi idénticos serían tres sitios donde olvidar el mismo cambio.

### 3. La comprobación de configuración legal se suma a la que ya existe, no crea un mecanismo nuevo

`src/instrumentation.ts` ya llama a `assertStorageConfiguredOrExit()`. Se añade `assertLegalConfiguredOrExit()` con el mismo contrato: en producción, si falta algo, escribe qué falta y `process.exit(1)`; en desarrollo no hace nada.

Se copia también la razón por la que el `process.exit` vive en el módulo y no en `instrumentation.ts`: ese archivo lo compila Next también para el runtime edge, donde `process.exit` no existe, y el empaquetador lo marca como error aunque haya guarda en tiempo de ejecución.

**Alternativa descartada:** validar con Zod al importar el módulo. Es perezoso otra vez — solo falla cuando alguien abre una página legal, que es exactamente el defecto que este diseño evita.

### 4. Un solo booleano decide si el entorno es producción real, y se reutiliza el que ya existe

`NODE_ENV` es `production` **también en staging** (es un build de producción). Usarlo para decidir la indexación indexaría staging. El sistema ya distingue entornos con `KORA_ENV` — es lo que hace que el worker escriba los correos a disco en staging en vez de enviarlos.

**Corregido durante la implementación.** La primera versión de esta decisión decía: *permitir el rastreo solo si `KORA_ENV === "production"`, prohibir en cualquier otro caso incluido el ausente*. Es la regla equivocada aquí, porque contradice cómo está desplegado el sistema: `deploy/README.md:141` documenta que **`KORA_ENV` sin definir se comporta como producción** — solo staging se declara (`KORA_ENV=staging`), y `.env.production` no lleva la variable. Con la regla original, producción se habría desplegado con `Disallow: /` y la tienda nunca habría aparecido en Google, sin que nada fallara.

Regla real: **es producción cuando `NODE_ENV === "production"` y `KORA_ENV` no es `staging`**. Es exactamente el predicado que `src/modules/email/config.ts` ya usaba para decidir si el correo sale de verdad.

Para no crear una segunda definición de "producción" que se desincronice —el mismo defecto que la decisión 5 evita para "producto publicado"—, ese predicado se **extrae** a `src/lib/environment.ts` y tanto el módulo de correo como `robots.ts` lo consumen. Un solo sitio decide qué es producción.

El riesgo que queda —un entorno nuevo que olvide `KORA_ENV` se declararía indexable— está cubierto por dos capas que no dependen de la aplicación: staging está tras autenticación básica (un rastreador recibe 401) y el borde añade `X-Robots-Tag: noindex` (`deploy/Caddyfile:45`). La cabecera se conserva a propósito.

### 5. El sitemap consulta el catálogo por la misma vía que la tienda

`sitemap.ts` usa las consultas de `src/modules/storefront/queries.ts`, no SQL propio. Si mañana cambia qué significa "producto publicado", cambia en un sitio y el sitemap lo hereda. Escribir aquí un `prisma.product.findMany` con su propio `where` es crear una segunda definición de publicado que se desincroniza en silencio.

Sin paginación: 1.000 productos caben de sobra en el límite de 50.000 URL de un sitemap.

### 6. La metadata Open Graph reutiliza `resolvePrice()` y el mismo `storeUrl` que ya usan los correos

La ficha ya carga su producto en `generateMetadata`; se añaden `openGraph` e `images`. La URL absoluta sale de `NEXT_PUBLIC_STORE_URL`, que ya existe. **No se calcula ningún precio nuevo**: si la metadata necesita precio, lo pide a `resolvePrice()` como todo lo demás (regla 7).

Para el producto sin imagen se usa el logo de marca ya presente en `public/`.

### 7. La vigencia del pedido en las condiciones se lee del código, no se escribe en el texto

La spec exige que el plazo publicado coincida con el que el sistema aplica. Se importa la constante de vigencia desde `src/modules/orders/` y se interpola. Un número escrito a mano en un texto legal es una promesa que deja de ser cierta el día que alguien cambia la constante, y nadie relee las legales.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **El texto legal lo escribe un ingeniero, no un abogado.** Puede ser insuficiente ante la SIC | Se traza cada afirmación a su norma (Ley 1581/2012, Decreto 1377/2013, Ley 1480/2011) y se declara en el proposal que la validación jurídica es decisión del cliente. Se entrega para revisión antes del go-live, no después |
| **Conflicto abierto con la política del cliente** ("no realiza devoluciones de dinero"). Publicar lo que el cliente dijo sería una cláusula abusiva; publicar otra cosa sin avisarle es cambiarle su política por nuestra cuenta | Se escribe la página preservando ambas cosas (su plazo de 30 días **y** los derechos irrenunciables), y **se marca como pendiente de su visto bueno explícito** antes del go-live. Queda una prueba que impide que el texto se convierta en una negación absoluta |
| **Sin datos del comerciante, producción no arranca** — es el comportamiento buscado, pero convierte un insumo del cliente en un bloqueo duro de despliegue | Es deliberado y se declara en el proposal. Alternativa —arrancar con marcadores— significa publicar `[NIT]` en una política vigente, que es peor. Los valores se piden hoy junto con el resto de insumos |
| **La política no queda versionada por pedido**: si mañana cambia, no habrá forma de saber qué aceptó un comprador de ayer | Deuda declarada en `notas-tecnicas-privado.md`. Mitigación parcial inmediata: cada página muestra su fecha de última actualización, y el historial real vive en Git |
| **El sitemap crece con el catálogo real** (hoy 21 productos de demo, mañana ~1.000) | Consulta ya paginada por el módulo; el límite de 50.000 URL queda lejos. Si algún día se acerca, Next admite sitemaps particionados sin cambiar el enfoque |

## Migration Plan

No hay migración Prisma. **No se emiten ni consumen eventos de `domain_events`** — nada de esto toca stock, precios, permisos ni estados de pedido.

1. Se despliega a staging con los datos del comerciante en marcador. Staging sigue con `KORA_ENV=staging`, así que su `robots.txt` prohíbe todo: se verifica ahí.
2. Antes de desplegar a producción, `deploy/.env.production` debe llevar las cuatro variables del comerciante. **Si no las lleva, el despliegue falla al arrancar y revierte solo** — que es el guion que ya existe.
3. Rollback: revertir el commit. No hay estado que deshacer.

## Open Questions

- **Correo de atención al titular de datos.** Hoy no existe buzón en `@korashopp.com` (Google Workspace quedó aplazado). Se puede publicar cualquier dirección que ya exista; no cambia el diseño, solo el valor de una variable.
- **¿Se traducen las legales al inglés** para el mercado de EE.UU.? No cambia el enfoque: sería un segundo archivo de contenido con el mismo componente.
