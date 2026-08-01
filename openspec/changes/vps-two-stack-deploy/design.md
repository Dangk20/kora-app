# Diseño — despliegue de dos entornos en el VPS propio

## Context

Motivación en `proposal.md` §Why. Requisitos en `specs/`. Aquí solo el estado que condiciona el enfoque:

- **La máquina.** Ubuntu 24.04, **2 vCPU / 7.8 GB de RAM / 96 GB de disco**. Ya endurecida el 31 jul: usuario `deploy` no-root, root bloqueado, acceso solo por llave pública, cortafuegos con 22/80/443, Docker CE 29.7.1 y Compose v5.3.1. La CPU es el recurso escaso, no la memoria ni el disco.
- **La aplicación nunca se ha empaquetado.** No hay `Dockerfile` ni `output: "standalone"`. Todo lo verificado hasta hoy corrió con `pnpm dev` o `pnpm start` contra contenedores locales de datos.
- **La integración continua ya existe y pasa** (`.github/workflows/ci.yml`: análisis estático, tipos, 79 pruebas y compilación, con Postgres efímero). El despliegue es un bloque comentado con un `TODO`.
- **DNS.** `test.korashopp.com` ya resuelve al servidor. El apex y `www` siguen en la página de parking del proveedor y no se tocan en este change.
- **Sin copias de imagen del servidor.** Se descartaron por presupuesto, lo que eleva la reconstrucción desde el repositorio de buena práctica a única vía de recuperación.

## Goals / Non-Goals

**Goals**

- Que el entorno de pruebas sea la consecuencia automática de integrar a la rama principal, sin pasos manuales.
- Que la separación entre entornos sea **estructural** (topología de red), no una convención de configuración que alguien pueda saltarse por descuido.
- Que el reparto de memoria esté escrito y sumado, no confiado a que "hay suficiente".
- Que el servidor completo se pueda reconstruir leyendo el repositorio.

**Non-Goals de diseño**

- **Alta disponibilidad.** Una sola máquina, una sola instancia de cada servicio. Un reinicio implica segundos de indisponibilidad y se acepta.
- **Despliegue sin corte.** Se opta por reinicio simple; la ruta a corte cero queda descrita pero no se implementa.
- **Autoescalado y orquestación.** Descartados desde el plan técnico; nada aquí los reintroduce por la puerta de atrás.
- **Optimizar la construcción de la imagen.** Basta con que sea correcta y cacheada por capas.

## Decisions

### 1. La imagen se construye en la integración continua, no en el servidor

**Decisión:** GitHub Actions compila la imagen y la publica en el registro de contenedores de GitHub, etiquetada con el hash del commit. El servidor solo descarga y levanta.

**Por qué:** compilar Next.js consume CPU y memoria de forma intensiva, y el servidor tiene **2 vCPU compartidos entre dos entornos y el borde**. Construir ahí significaría degradar producción cada vez que alguien integra un cambio. Además, una imagen etiquetada por commit es un artefacto inmutable: revertir es volver a levantar la etiqueta anterior, sin reconstruir nada.

**Alternativas descartadas:** construir en el servidor con `docker compose build` (simple, pero paga con la CPU que necesita producción); usar un registro de terceros (una dependencia y una credencial más sin beneficio, teniendo el del repositorio incluido).

### 2. Aislamiento por topología de red, no por credenciales

**Decisión:** cuatro redes Docker. El borde participa en dos redes de frontera, una por entorno; cada aplicación participa en su frontera y en su red interna privada; las bases de datos y cachés viven **solo** en la red interna de su entorno y no publican puertos al servidor.

```
                    ┌──────── caddy ────────┐
                    │  (80/443, único)      │
          ┌─────────┴────────┐   ┌──────────┴────────┐
          │  edge-staging    │   │    edge-prod      │
          │                  │   │                   │
      app-staging            │   │              app-prod
          │                  │   │                   │
    ┌─────┴──────────┐       │   │       ┌───────────┴─────┐
    │ net-staging    │       │   │       │   net-prod      │
    │  postgres      │       │   │       │    postgres     │
    │  redis         │       │   │       │    redis        │
    └────────────────┘       │   │       └─────────────────┘
```

**Por qué:** el requisito de aislamiento exige que un contenedor de pruebas no pueda alcanzar la base de producción **por ninguna vía**. Con credenciales distintas sobre una red compartida, el aislamiento depende de que nadie copie una cadena de conexión; con redes separadas, el nombre del servicio de producción sencillamente no resuelve desde pruebas. El fallo es de red, no de autenticación — que es exactamente lo que el escenario de la especificación exige poder demostrar.

**Consecuencia aceptada:** las dos aplicaciones no comparten ninguna red entre sí, solo con el borde. Ni siquiera pueden hablarse por HTTP.

**Alternativa descartada:** una sola red con contraseñas distintas. Más simple de escribir y imposible de demostrar.

### 3. Presupuesto de memoria explícito, CPU por peso relativo

**Decisión:** límite duro de memoria por contenedor; para CPU, **peso relativo** en lugar de tope fijo, salvo un tope en pruebas.

| Entorno | Servicio | Memoria | CPU |
|---|---|---:|---|
| Borde | caddy | 128 MB | peso normal |
| Producción | app | 1536 MB | peso alto |
| Producción | postgres | 1536 MB | peso alto |
| Producción | redis | 256 MB | peso alto |
| Pruebas | app | 1024 MB | peso bajo, tope 1 vCPU |
| Pruebas | postgres | 768 MB | peso bajo, tope 1 vCPU |
| Pruebas | redis | 128 MB | peso bajo |
| **Total comprometido** | | **≈ 5.4 GB** | |
| **Margen para sistema operativo y caché de disco** | | **≈ 2.4 GB** | |

**Por qué el peso y no el tope en CPU:** con solo 2 vCPU, poner topes fijos desperdicia capacidad ociosa — producción no podría usar la CPU que pruebas no está usando. El peso relativo reparte solo cuando hay contención, que es cuando importa. El tope en pruebas existe para que una compilación o una prueba de carga accidental no acapare ambos núcleos.

**Por qué queda margen libre:** PostgreSQL depende del caché de disco del sistema operativo para su rendimiento de lectura. Comprometer los 7.8 GB en límites de contenedor haría más lentas ambas bases.

### 4. Se difiere PgBouncer — desviación explícita del plan técnico

**Decisión:** la aplicación se conecta directamente a PostgreSQL con un tamaño de pool acotado. **PgBouncer no se instala en este change**, pese a estar nombrado en el DoD de la Semana 1 del plan técnico.

**Por qué:** PgBouncer paga cuando hay muchos procesos de aplicación abriendo conexiones. Aquí hay **una sola instancia** por entorno con su pool ya limitado — el problema que resuelve todavía no existe. En cambio sí introduce un costo inmediato: en modo transacción rompe las sentencias preparadas de Prisma, obligando a desactivarlas y a arrastrar una bandera de compatibilidad en cada cadena de conexión; en modo sesión no aporta nada frente a conectar directo. Añadirlo hoy es complejidad y una clase entera de fallos sutiles a cambio de un beneficio nulo.

**Cuándo entra:** en el momento en que se corra más de una réplica de la aplicación, o cuando la prueba de carga de la Semana 15 muestre agotamiento de conexiones. Ese es su disparador, y queda anotado como deuda consciente.

**Alternativa descartada:** instalarlo ahora "porque está en el plan". El plan es un documento rector, no un contrato: el principio vigente es no construir para una escala que no existe. La desviación se registra en las notas técnicas privadas.

### 5. Un solo borde, configuración versionada

**Decisión:** un único contenedor de proxy con un archivo de configuración en el repositorio y volumen persistente para los certificados. La página de espera se sirve como archivo estático desde ese mismo contenedor.

**Por qué:** el requisito exige que el borde sobreviva a la caída de cualquier entorno y que la página de espera funcione con la aplicación detenida. Servirla desde el proxy — y no desde Next.js — es lo que hace ambas cosas ciertas por construcción. El volumen de certificados evita volver a solicitarlos en cada recreación y chocar con los límites del emisor.

**Alternativa descartada:** un proxy por entorno. Solo hay un par de puertos 80/443 en la máquina; habría que poner otro proxy por encima.

### 6. Migración como paso previo, no como arranque de la aplicación

**Decisión:** el despliegue ejecuta las migraciones en un contenedor efímero que corre hasta terminar. Solo si termina bien se recrea el contenedor de la aplicación.

**Por qué:** si las migraciones corrieran al arrancar la aplicación, un fallo dejaría la aplicación caída y el esquema a medias. Como paso previo, un fallo detiene el despliegue y **la versión anterior sigue sirviendo**, que es justo lo que exige el escenario de la especificación.

### 7. Reversión por etiqueta, no por reconstrucción

**Decisión:** cada imagen se etiqueta con el hash del commit y el servidor guarda cuál está activa. Revertir es levantar la etiqueta anterior.

**Por qué:** es la operación más rápida y menos propensa a error en una emergencia — descargar una imagen ya construida frente a reconstruir en una máquina de 2 vCPU bajo presión. Las migraciones no se revierten automáticamente: se asume compatibilidad hacia atrás en el esquema, y una migración destructiva exige un plan propio.

### 8. Fallar al arrancar, no al primer render *(añadido el 31 jul)*

**Decisión:** la comprobación de configuración del almacenamiento de imágenes pasa de evaluarse en el primer uso a evaluarse al arrancar el proceso, en producción. Si falta, el proceso termina.

**Por qué:** medido durante la implementación, el comportamiento actual es que la aplicación arranca sin problemas y solo devuelve error al renderizar una página con imágenes. Eso significa que un contenedor mal configurado **pasa cualquier verificación de salud** y el orquestador lo da por bueno. El despliegue reporta éxito, la tienda no funciona, y el descubrimiento queda en manos del primer cliente que entre.

Arrancar es el único momento en que un error de configuración es barato: no hay tráfico, la versión anterior sigue viva y el despliegue puede detenerse solo. Fallar ahí convierte una caída en producción en un despliegue rojo.

**Alcance:** es la única lógica de `src/` que toca este change. No se rediseña el módulo de almacenamiento ni se cambian sus drivers: solo cuándo se evalúa su configuración.

**Alternativa descartada:** dejarlo como está y corregir la afirmación de `CLAUDE.md` y del plan técnico para que describan el comportamiento real. Documenta con precisión un comportamiento peor; la afirmación de esos documentos era la correcta, lo que faltaba era el código.

### 9. Credencial de despliegue dedicada

**Decisión:** un par de llaves nuevo, exclusivo del despliegue, autorizado en el servidor y guardado en los secretos del repositorio. La llave personal del desarrollador nunca entra ahí.

**Por qué:** lo exige la especificación, y la razón es concreta — una fuga de los secretos del repositorio no puede convertirse en una fuga de la identidad de una persona, y revocar el despliegue no puede dejar a nadie fuera del servidor.

## Dónde vive cada cosa

Este change es infraestructura casi por completo. La **única** excepción es el momento en que se evalúa la configuración del almacenamiento (decisión 8), que vive donde ya vivía esa lógica —`src/modules/storage/`— y no crea un módulo nuevo. Todo lo demás vive fuera del código de la aplicación:

```
Dockerfile                        empaquetado de la aplicación (multi-etapa)
.dockerignore
next.config.ts                    (modificado) output: "standalone"
src/modules/storage/              (modificado) comprobación al arranque, no perezosa
tests/                            prueba que fija esa guarda
deploy/
  docker-compose.edge.yml         proxy compartido
  docker-compose.staging.yml      entorno de pruebas
  docker-compose.prod.yml         entorno de producción
  Caddyfile                       enrutamiento, cifrado, protección de pruebas
  holding/index.html              página de espera y sus recursos
  README.md                       reconstrucción del servidor desde cero
.github/workflows/ci.yml          (modificado) jobs de despliegue
```

**Sin migración de esquema.** No se toca el modelo de datos ni se emiten o consumen eventos de `domain_events`.

**Fidelidad de diseño:** la página de espera no tiene equivalente en el prototipo aprobado — no es una pantalla del producto. Toma color y tipografía de los tokens de marca de `src/app/globals.css` y su texto del brand book; su composición es propia y deliberadamente mínima.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Dos entornos en una máquina: pruebas degrada producción.** | Límites duros de memoria y tope de CPU en pruebas. El reparto está sumado y documentado, con margen para el sistema operativo. |
| **Punto único de fallo.** Sin copias de imagen del proveedor, perder la máquina es perder el servicio. | Todo reconstruible desde el repositorio, verificado como requisito. **No queda cubierto el dato**: eso depende del respaldo cifrado, que es un change aparte y **bloquea el go-live**. |
| **Producción no puede levantar hasta que exista la cuenta de almacenamiento**, porque tras la decisión 8 la aplicación se niega a arrancar sin sus variables. | Es el comportamiento deseado, no un error: obliga a descubrir el problema al desplegar y no con el primer cliente. Entretanto solo se publica la página de espera, que se sirve desde el borde y no depende de la aplicación. |
| **El primer despliegue puede agotar la cuota de emisión de certificados** si se repite por ensayo y error. | Usar el entorno de pruebas del emisor mientras se ajusta la configuración, y pasar al definitivo cuando el enrutamiento esté verificado. |
| **La contraseña del entorno de pruebas se filtra o se comparte de más.** | Es protección contra indexación y confusión, no un control de seguridad fuerte. El entorno de pruebas no debe contener jamás datos reales de clientes. |
| **Reinicio con corte durante el despliegue.** | Aceptado mientras no haya tráfico real. La ruta a corte cero —dos réplicas y balanceo en el borde— queda descrita para cuando se necesite. |
| **Diferir PgBouncer resulta equivocado bajo carga.** | Disparador explícito: más de una réplica, o agotamiento de conexiones en la prueba de carga de la Semana 15. Añadirlo después es un change acotado, no un rediseño. |

## Migration Plan

Sin migración de datos. La secuencia de puesta en marcha:

1. **Empaquetar** la aplicación y verificar que la imagen arranca en local contra los contenedores de desarrollo.
2. **Levantar el borde** con la página de espera solamente. Verificable de inmediato en el dominio de pruebas, sin depender de la aplicación.
3. **Levantar el entorno de pruebas** completo, con migraciones y datos de demostración, protegido por autenticación.
4. **Conectar el despliegue automático** y comprobarlo con un cambio real integrado a la rama principal.
5. **Levantar el entorno de producción** sin publicarlo: alcanzable por una vía interna para verificación, con el apex todavía en la página de parking.
6. **Publicar la página de espera** repuntando el apex y `www` al servidor. Es el único paso de este change que el visitante percibe.

**Reversión:** en cualquier punto, devolver el registro DNS del apex a su valor actual restaura la página de parking. El entorno de pruebas puede destruirse por completo sin efecto sobre producción — esa es precisamente la propiedad que verifica la especificación de aislamiento.

## Open Questions

- **¿El entorno de pruebas debe reiniciar sus datos de demostración en cada despliegue, o conservar lo que se haya creado a mano probando?** Afecta a la comodidad de las pruebas, no a la arquitectura; se puede cambiar después sin tocar especificaciones ni tareas. Propuesta provisional: conservar, y ofrecer un comando explícito para reiniciar.
- **Política de retención de imágenes en el registro.** Sin resolver no pasa nada durante meses; se ajusta cuando el almacenamiento lo pida.
