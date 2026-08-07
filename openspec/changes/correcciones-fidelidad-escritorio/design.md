## Context

Ver `proposal.md` y `docs/auditoria-fidelidad-escritorio.md`. Lo que condiciona el diseño:

- `STATUS_LABEL` y `STATUS_STYLE` ya existen (`src/modules/orders/status.ts:16,31`) y los usan tres pantallas. La cuarta no.
- `product-card.tsx` monta `AddToCartButton`, que a su vez es cliente y arrastra el contexto del carrito a cada tarjeta del listado.
- Las tres garantías del home viven en `home-layout.tsx` como una constante local.

## Goals / Non-Goals

**Goals**
- Que ninguna regla escrita del proyecto siga incumplida por el código.
- Reutilizar lo que ya existe en vez de escribir una segunda versión.

**Non-Goals**
- El resto de la auditoría (F1–F3, F6–F8). Cada uno necesita decisión o semana propia.
- Rediseñar la tarjeta. Se le quita el botón; lo demás se queda.

## Decisions

### 1. El dashboard usa el mismo par etiqueta+estilo que Pedidos, no uno propio

Se importa `STATUS_LABEL` y `STATUS_STYLE` y se pinta el mismo badge.

**Por qué importa más de lo que parece:** el defecto no fue "olvidar traducir", fue **pintar el dato en crudo teniendo el formateador al lado**. Escribir aquí un `status === "CONFIRMED" ? "Confirmado" : …` arreglaría la pantalla y crearía una segunda tabla de etiquetas que se desincroniza en cuanto se añada un estado. Se consume la que ya existe.

### 2. La tarjeta pasa a ser un único `<Link>`, y deja de ser un componente cliente por el botón

Hoy la tarjeta envuelve zonas enlazables y monta `AddToCartButton`, que necesita el contexto del carrito. Al quitar el botón, la tarjeta **no necesita nada de cliente**: es marcado y un enlace.

Beneficio que no se buscaba pero llega solo: el listado deja de instanciar un componente cliente por producto. Con 21 productos son 21 menos; con el catálogo real serán cientos.

**Corrección durante la implementación:** el diseño daba por hecho que la tarjeta tenía enlaces anidados en la imagen y el nombre. **No era así** — ya era un único `<Link>` envolviendo todo, con el botón dentro. Así que el trabajo se reduce a quitar el botón; el objetivo táctil único ya existía.

**Y una consecuencia que sí apareció:** al quitar el botón, el prop `preview` —que Vitrina usa para decir "esto es una vista previa, no interactúa"— se quedó sin nada que apagar. En vez de borrar el concepto, se le devolvió su sentido: en la vista previa la tarjeta se renderiza como `<div>` y no navega. Antes la bandera solo apagaba el botón y la tarjeta **seguía sacando al operador del panel**; ahora apaga lo único que queda.

`AddToCartButton` **no se borra**: sigue siendo el botón de la ficha, que es donde la compra se decide.

### 3. Las garantías de la ficha son LAS MISMAS del home — se comparte el CONTENIDO, no la maqueta

`GUARANTEES` sale de `home-layout.tsx` a `guarantees.ts` y lo consumen las dos pantallas. **Cada una lo pinta a su tamaño**: el home ya tenía su tratamiento y era correcto, así que unificar la maqueta habría cambiado una pantalla que la auditoría no señaló.

Lo que no puede divergir es **qué se promete**. El componente de la ficha vive aparte (`product-guarantees.tsx`) porque el archivo de datos tiene que poder importarse desde las pruebas, que corren sin transformar JSX.

Copiarlas sería garantizar que el día que cambie una promesa comercial —que es cosa del cliente, no nuestra— quede corregida en una pantalla y viva en la otra. Y la que se olvide será la de la ficha, que es la que se lee justo antes de comprar.

No se usan las tres del prototipo (compra protegida, envío gratis, devoluciones a 7 días): son exactamente las que se decidió no publicar porque el negocio no las sostiene.

### 4. Sin cambios de datos

No hay migración, no se emiten ni consumen eventos, no se toca stock, precios, permisos ni estados.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Quitar el botón alarga el camino a la compra** en productos sin variantes | Es la decisión aprobada y la que recomienda el diseño móvil. El coste real es un toque más; el coste del botón era un carrito con la variante equivocada descubierto por WhatsApp. Reconsiderar si se mide que la mayoría de pedidos son de productos sin variantes |
| **Extraer `GUARANTEES` toca el home**, que ya estaba correcto | Es un movimiento de constante, sin cambio de contenido. Queda cubierto por la comprobación de que las promesas prohibidas no aparecen |
| **La tarjeta deja de ser cliente**: si mañana necesita interacción, hay que volver | Es una mejora, no una restricción de diseño: `AddToCartButton` sigue existiendo y se puede montar donde haga falta |

## Migration Plan

No hay migración. Rollback: revertir el commit.
