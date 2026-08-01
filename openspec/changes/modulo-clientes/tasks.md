# Tareas — módulo de clientes

> Bloques de 2 horas o menos, verificables por sí solos.
> Evidencia obligatoria por tarea: prueba en verde, salida de comando o verificación en la aplicación real.

## 1. Quitar "CRM" del sistema

- [ ] 1.1 Cambiar la matriz de permisos del seed: `crm` → `customers`, conservando las cuatro acciones.
- [ ] 1.2 Escribir la migración que **renombra** las filas de permisos existentes con `UPDATE`. No borrarlas y recrearlas: están referenciadas por las asignaciones a roles y se quedarían sin permisos.
- [ ] 1.3 Actualizar `tests/rbac.test.ts`, que fija la matriz, y añadir la comprobación de que **no existe ningún módulo llamado `crm`**.
- [ ] 1.4 Renombrar `src/modules/crm/` → `src/modules/customers/`, actualizar `src/modules/README.md` y la entrada de `nav-links.tsx`.
- [ ] 1.5 Verificar contra la base de desarrollo que los roles conservan sus permisos tras la migración.

## 2. Las consultas, antes que las pantallas

- [ ] 2.1 Escribir el predicado único de "pedido confirmado" y usarlo en **todas** las consultas del módulo. Seis sitios con su propio filtro es la vía directa a que la tarjeta y el perfil muestren números distintos.
- [ ] 2.2 Resumen: nuevos en 30 días, activos en 30 días (con pedido confirmado), total y con cuenta.
- [ ] 2.3 Listado con búsqueda por nombre, teléfono o correo y paginado, **ambos en servidor**. Búsqueda insensible a mayúsculas y acentos, y que encuentre el teléfono se escriba con indicativo o sin él.
- [ ] 2.4 Días de mayor pedido por cliente: agregación por día de la semana sobre pedidos confirmados, resuelta en la base.
- [ ] 2.5 Métricas del perfil: pedidos confirmados, días de inactividad y ticket promedio **por moneda**, con la predominante destacada.
- [ ] 2.6 Top cinco de categorías: unidades y gasto agregados en la base, orden descendente, empate resuelto por mayor gasto.

## 3. Pruebas de las reglas de cálculo

> Una métrica equivocada no se nota: un número plausible no levanta sospechas. Estas reglas se fijan con prueba, no con revisión visual.

- [ ] 3.1 Un pedido **pendiente** no cuenta en ninguna métrica; un **cancelado** tampoco.
- [ ] 3.2 Un pedido que avanzó más allá de confirmado (preparando, enviado, entregado) **sí** cuenta: sigue siendo una venta.
- [ ] 3.3 El ticket promedio **no suma monedas distintas**: un cliente con pedidos en las dos muestra el de la predominante y la otra aparte.
- [ ] 3.4 Un cliente sin pedidos confirmados devuelve cero, "sin pedidos" y cero — sin división por cero ni error.
- [ ] 3.5 El top de categorías resuelve el empate de unidades por mayor gasto.
- [ ] 3.6 El top solo incluye categorías con compras confirmadas reales.
- [ ] 3.7 La búsqueda encuentra el mismo teléfono escrito en formatos distintos.

## 4. Alta, edición y unicidad

- [ ] 4.1 Normalizar el teléfono a formato internacional **antes** de comprobar duplicados. Comprobar sobre lo escrito deja pasar el mismo número en otro formato, y la restricción de la base no lo detecta porque son cadenas distintas.
- [ ] 4.2 Acción de alta con `requirePermission`, rechazando teléfono o correo duplicados con un motivo legible.
- [ ] 4.3 Acción de edición, incluido el cambio de teléfono; rechazar si colisiona con **otro** cliente y no señalar al cliente contra sí mismo.
- [ ] 4.4 Confirmar que **no existe** ninguna acción de eliminación, ni en la interfaz ni en el servidor.

## 5. Pruebas de unicidad y permisos

- [ ] 5.1 Alta con teléfono duplicado → rechazada, sin crear fila.
- [ ] 5.2 Alta con el mismo número en otro formato → detectada como duplicada.
- [ ] 5.3 Cambio de teléfono a uno ocupado → rechazado, sin modificar nada.
- [ ] 5.4 Guardar sin tocar el teléfono → no se señala a sí mismo como duplicado.
- [ ] 5.5 Cambio de teléfono válido → el cliente conserva pedidos y métricas.
- [ ] 5.6 Permiso revocado con sesión viva → la acción es rechazada (se verifica contra la base, no contra la sesión).

## 6. Las pantallas

- [ ] 6.1 Vista `/admin/clientes`: cuatro tarjetas de resumen, buscador y tabla con avatar de iniciales, WhatsApp, correo, país y días de mayor pedido. **Sin eliminar, sin columna de tipo de cliente.** Replicando el patrón de Productos e Inventario y mirando su equivalente en el prototipo aprobado.
- [ ] 6.2 Panel de perfil (`?ver=<id>`): encabezado con contacto y distintivo de cuenta, tres métricas, bloque de saldo de fidelización en cero, y top de categorías.
- [ ] 6.3 Botón de contacto por WhatsApp con `api.whatsapp.com/send`, **nunca `wa.me`**, con el motivo comentado en el código: su redirección rompe los caracteres de 4 bytes. Deshabilitado si el cliente no tiene teléfono.
- [ ] 6.4 Paneles de alta (`?nuevo=1`) y edición (`?editar=<id>`), con los errores dentro del panel y conservando lo escrito.
- [ ] 6.5 Estados vacíos: base sin clientes, búsqueda sin resultados, cliente sin compras. Ninguno debe verse como un error.
- [ ] 6.6 Entrada en la navegación del panel, visible solo con el permiso correspondiente.

## 7. Verificación de punta a punta

- [ ] 7.1 Con los clientes que el checkout ya creó: abrir la vista, comprobar que las tarjetas cuadran con el listado y que el perfil de un cliente con compras muestra métricas correctas.
- [ ] 7.2 Confirmar un pedido desde el panel y comprobar que las métricas del cliente **cambian en consecuencia**.
- [ ] 7.3 Crear un cliente a mano, intentar duplicar su teléfono y comprobar el rechazo con mensaje legible.
- [ ] 7.4 Editar el teléfono de un cliente con compras y comprobar que **conserva su historial**.
- [ ] 7.5 Entrar con un usuario sin el permiso y comprobar que no accede a la vista.

## 8. Cierre

- [ ] 8.1 Actualizar `../hus-clientes.md` y el tablero de Notion: las cuatro HUs pasan a hechas. **La doble sincronización es obligatoria**, no opcional.
- [ ] 8.2 Registrar en `../notas-tecnicas-privado.md`: el conflicto de la historia de usuario con `wa.me` y por qué gana la regla; el renombrado de `crm`; y que no se ofrece fusión de duplicados.
- [ ] 8.3 Actualizar `../bitacora-sprints-kora.md`: S10 avanza; queda pendiente la importación masiva, que es su propio change.
- [ ] 8.4 Correr `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y dejarlos en verde.
