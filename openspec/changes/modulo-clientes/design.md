# Diseño — módulo de clientes

## Context

Motivación en `proposal.md`. Requisitos en `specs/`.

**Lo que ya existe y no hay que construir:**

- `Customer` con `phone` y `email` únicos, país, dirección, `acceptsMarketing`, y un `pointsBalance` materializado que hoy siempre vale cero.
- **La tabla se llena sola**: `createOrder()` busca al comprador por correo y por teléfono en E.164 y lo crea si no existe. Los clientes de la vista no salen de la nada.
- El patrón del panel está establecido en Productos e Inventario: página de servidor que lee `searchParams`, decide qué panel lateral abrir y renderiza la lista. Es lo que hay que replicar.
- `requirePermission()` verifica contra la base.

**Lo que existe y está mal nombrado:** la matriz declara `crm`, hay un `src/modules/crm/` vacío con solo un `.gitkeep`, y `nav-links.tsx` lo referencia. Ningún código lo usa todavía.

**El dato incómodo:** las métricas de esta pantalla son agregaciones sobre pedidos y sus líneas. Hacerlas mal es fácil y **no se nota**, porque un número plausible no levanta sospechas.

## Goals / Non-Goals

**Goals**

- Que todos los números signifiquen lo mismo: **pedidos confirmados y nada más**.
- Que la vista siga funcionando con una base real, no con veinte clientes de prueba.
- Dejar el hueco del saldo de fidelización listo para conectar, sin esperar al cashback.
- Quitar la palabra "CRM" del sistema mientras todavía es barato.

**Non-Goals de diseño**

- **Fusionar clientes duplicados.** Se detecta y se rechaza; fusionar es una decisión de producto con consecuencias sobre saldos.
- **Caché de métricas.** Se calculan en cada carga. Con el volumen previsto es correcto, y una caché mal invalidada muestra números viejos que parecen buenos.
- **Exportación.** El permiso existirá, la función no es de este change.

## Decisions

### 1. Renombrado `crm` → `customers`, con migración de datos

**Decisión:** cambiar la clave en la matriz del seed, renombrar el directorio vacío del módulo, actualizar la navegación y las pruebas de la matriz, y **migrar las filas de permisos existentes** en lugar de borrarlas y recrearlas.

**Por qué migrar y no recrear:** las filas de permisos están referenciadas por `role_permissions`. Borrarlas y volver a insertarlas con identificadores nuevos dejaría a los roles **sin sus permisos** en cualquier base donde ya se hubiera ejecutado el seed — incluida la de pruebas del servidor. Un `UPDATE` del nombre conserva el identificador y, con él, las asignaciones.

**Por qué ahora:** ningún código consume el permiso todavía y ningún rol de producción lo tiene. Es la última ventana en la que esto cuesta una migración de una línea en vez de una conversación sobre usuarios reales.

### 2. Las métricas se calculan en la base, no en la aplicación

**Decisión:** los indicadores del resumen, los días de mayor pedido, el ticket promedio y el top de categorías se resuelven con consultas agregadas. Las que Prisma no expresa bien —agrupar por día de la semana, agrupar líneas por categoría— van en SQL directo.

**Por qué:** la alternativa es traer los pedidos de cada cliente a la aplicación y sumarlos ahí. Con veinte clientes de prueba funciona; con dos mil clientes y sus pedidos, la vista deja de cargar. La historia de usuario exige explícitamente que aguante miles, y esa exigencia solo se puede cumplir por construcción — no se arregla después sin rehacer la pantalla.

**Consecuencia aceptada:** algunas consultas serán SQL directo y no Prisma. Es el mismo criterio que ya siguió el motor de inventario con `FOR UPDATE`: cuando el ORM no expresa lo que la corrección exige, se baja a SQL y se documenta por qué.

### 3. "Confirmado" tiene una única definición, en un solo sitio

**Decisión:** un único predicado compartido define qué pedidos cuentan, y todas las consultas del módulo lo usan.

**Por qué:** hay seis lugares distintos donde se filtra por pedidos confirmados. Si cada uno escribe su propio filtro, basta con que uno olvide excluir los cancelados para que el ticket promedio y el total de pedidos **discrepen entre la tarjeta y el perfil** — y ese es exactamente el tipo de error que nadie reporta porque ambos números parecen razonables.

**Qué cuenta como confirmado:** todo pedido que llegó a confirmarse, incluidos los que avanzaron a estados posteriores. Un pedido entregado sigue siendo una venta. Solo se excluyen los pendientes y los cancelados.

### 4. Las dos monedas nunca se mezclan

**Decisión:** el ticket promedio se calcula **por moneda**; se muestra el de la moneda con más pedidos y se indica aparte cuántos hay en la otra.

**Por qué:** no existe tasa de cambio en KORA, y es deliberado — cada divisa usa su propio precio cargado. Sumar pesos y dólares produciría un número que **parece correcto** y no significa nada. La regla del sistema es que las monedas no se convierten; esta pantalla no puede ser la excepción.

### 5. El saldo de fidelización se lee de la columna materializada

**Decisión:** el perfil lee `pointsBalance` del cliente, que hoy siempre vale cero.

**Por qué:** es lo que la historia de usuario pide —mostrar cero sin error mientras el módulo no exista— y deja el trabajo hecho: cuando llegue Kora Cashback, esa columna se materializará desde su libro y la pantalla no cambia.

**Nota para el cashback:** el saldo será **por moneda**, porque los dos saldos no se suman. Esta pantalla mostrará el de la moneda predominante del cliente, con el mismo criterio que el ticket promedio.

### 6. Paneles laterales controlados por la dirección de la página

**Decisión:** `?ver=<id>`, `?nuevo=1`, `?editar=<id>`, igual que el resto del panel.

**Por qué:** es el patrón ya establecido, hace los paneles enlazables y sobrevive a recargar. Cambiar de patrón en una pantalla es peor que el patrón que se elija.

### 7. Normalizar el teléfono antes de comparar, no solo antes de guardar

**Decisión:** la normalización a formato internacional ocurre **antes** de la comprobación de duplicados.

**Por qué:** si se comprueba el duplicado sobre lo que la persona escribió, `320 827 0414` y `+573208270414` pasan como clientes distintos y la restricción de unicidad de la base no los detecta — porque para ella son cadenas distintas. El duplicado entra, y como no se puede eliminar, se queda.

## Dónde vive cada cosa

```
src/modules/customers/          (sustituye al directorio vacío `crm/`)
  queries.ts    agregaciones: resumen, listado con búsqueda y paginado
  profile.ts    métricas del perfil y top de categorías
  actions.ts    alta y edición, con requirePermission
  phone.ts      normalización a E.164 y comprobación de duplicados
src/app/admin/clientes/
  page.tsx           lectura en servidor + decisión de qué panel abrir
  customer-sheet.tsx panel de perfil (solo lectura)
  customer-form.tsx  panel de alta y edición
tests/customers.test.ts
```

**Migración de Prisma:** una, y solo de datos — renombra el módulo de permisos. **No hay cambios de esquema**: `Customer` ya tiene todo lo que la pantalla necesita.

**Eventos de dominio:** no emite ni consume. Lee lo que el worker ya dejó consolidado.

**Fidelidad de diseño:** listado con paneles laterales, replicando Productos e Inventario y mirando su equivalente en el prototipo aprobado. Color y tipografía de los tokens de marca; botón principal con la variante de marca.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Una métrica equivocada no se nota.** Un número plausible no levanta sospechas, y sobre él se toman decisiones de remarketing. | Cada regla de cálculo se fija con prueba: solo confirmados, monedas sin mezclar, empates del top por gasto. La revisión visual no sirve aquí. |
| **El renombrado del permiso deja a alguien sin acceso** si se recrean las filas en vez de renombrarlas. | Se migra con `UPDATE`, conservando identificadores y por tanto las asignaciones a roles. Hay escenario de spec que lo cubre. |
| **Un duplicado por teléfono es permanente**, porque no se puede eliminar. | Normalización antes de comparar, restricción de unicidad en la base como última línea, y rechazo explícito en vez de fusión silenciosa. |
| **Las consultas agregadas crecen con el catálogo y la base.** | Se resuelven en la base, con paginado en servidor. **Disparador para revisar:** que la vista tarde de forma perceptible con datos reales, momento en que la caché deja de ser prematura. |
| **La historia de usuario dice `wa.me` y alguien "corregirá" el código para cumplirla.** | Está escrito en la especificación y va comentado en el código con el motivo — el emoji partido — no solo con la regla. |

## Migration Plan

1. Renombrar el módulo de permisos (migración de datos) y actualizar seed, navegación y pruebas de la matriz.
2. Construir las consultas agregadas con sus pruebas, antes que ninguna pantalla.
3. Construir la vista, el perfil y los formularios.
4. Verificar contra datos reales: los clientes que el checkout ya creó.

**Reversión:** el módulo es de lectura salvo el alta y la edición de datos de contacto. Quitar la entrada de navegación lo oculta sin efectos. El renombrado del permiso sí requiere migración inversa, que es simétrica.

## Open Questions

- **Tamaño de página del listado.** Se ajusta viendo datos reales; no cambia specs ni tareas.
- **Qué se considera "moneda predominante"** cuando hay empate exacto de pedidos entre las dos. Se resolverá por el mayor gasto, mismo criterio que el desempate del top de categorías — y si el cliente pide otra cosa, es un ajuste local.
