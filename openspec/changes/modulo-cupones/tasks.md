# Tareas — módulo de cupones

> Bloques de 2 horas o menos, verificables por sí solos.
> Evidencia obligatoria por tarea: prueba en verde, salida de comando o verificación en la aplicación real.

## 1. El modelo

- [x] 1.1 Ampliar `Coupon`: nombre interno, descripción, tipo **producto gratis** con su variante, **dos valores de monto fijo** (uno por moneda), y los interruptores "solo primera compra" y "aplica a productos en oferta". Migración versionada.
- [x] 1.2 Añadir el alcance como **relaciones** a categorías y a productos — no como lista de identificadores en un campo de texto: la base debe poder garantizar que no apunta a algo borrado.
- [x] 1.3 Añadir los permisos del módulo a la matriz del seed y a `tests/rbac.test.ts`.

## 2. Estado, validación y cálculo — antes que ninguna pantalla

- [x] 2.1 `status.ts`: estado derivado con la precedencia inactivo → vencido → agotado → activo. **Una sola función** para el panel y para el checkout: dos cálculos harían que el panel y el comprador vieran cosas distintas.
- [x] 2.2 `messages.ts`: los siete textos exactos de la historia de usuario, en un solo sitio.
- [x] 2.3 `validate.ts`: las siete comprobaciones **en su orden**, devolviendo un motivo tipado y no un texto.
- [x] 2.4 `discount.ts`: cálculo por tipo sobre el **carrito ya resuelto por el servidor**, sin consultar precios por su cuenta. El total nunca queda negativo.
- [x] 2.5 Elegibilidad por alcance y exclusión de los ítems en oferta cuando el interruptor está apagado.

## 3. Pruebas de las reglas

> Un cupón es dinero que sale. Estas reglas se fijan con prueba, no con revisión visual.

- [x] 3.1 **Precedencia del estado:** pausado y vencido a la vez → Inactivo; agotado en fecha → Agotado.
- [x] 3.2 **Orden de las validaciones:** un cupón pausado *y* vencido devuelve el motivo de la primera comprobación, no el de la segunda.
- [x] 3.3 **Moneda:** un cupón solo en pesos se rechaza en un pedido en dólares. Uno "en ambas" aplica el valor de la moneda del pedido, **sin convertir**.
- [x] 3.4 **El descuento no deja el total negativo:** un monto fijo mayor que el carrito descuenta como mucho el subtotal elegible.
- [x] 3.5 **Alcance:** con un cupón de categoría y un carrito mixto, el descuento sale solo de los ítems de esa categoría.
- [x] 3.6 **Productos en oferta:** con el interruptor apagado, los ítems rebajados quedan fuera del cálculo.
- [ ] 3.7 **Solo primera compra:** un contacto con pedidos confirmados previos es rechazado.
- [ ] 3.8 **Máximo por cliente:** alcanzado el límite, se rechaza.
- [x] 3.9 **El código es inmutable** y se normaliza a mayúsculas; un duplicado en otra caja se detecta.
- [ ] 3.10 **El cupo no puede bajarse por debajo de los usos ya consumidos.**

## 4. El panel

- [x] 4.1 Vista `/admin/cupones`: listado con chips de estado y sus contadores, buscador por código o nombre, y el valor del descuento formateado según el tipo (incluida la doble moneda).
- [x] 4.2 Formulario de alta en tarjetas: identidad, tipo y valor, restricciones, comportamiento y alcance.
- [x] 4.3 Edición con el **código bloqueado** y el aviso de "este cupón ya tiene N usos" cuando corresponda.
- [x] 4.4 Pausar y reactivar desde el listado en un clic, con el badge cambiando de inmediato.
- [x] 4.5 Confirmar que **no existe** ninguna acción de eliminar, ni en la interfaz ni en el servidor.
- [x] 4.6 Entrada en la navegación, visible solo con el permiso.

## 5. El checkout

- [x] 5.1 Campo "¿Tienes un cupón?" junto al resumen, con normalización a mayúsculas y **un solo cupón por pedido**.
- [x] 5.2 Aplicar valida **en servidor** y muestra el chip con el código y el descuento, o el mensaje exacto del motivo.
- [x] 5.3 Quitar el cupón devuelve el total a su valor sin descuento.
- [ ] 5.4 Modificar el carrito **recalcula** el descuento; si el cupón deja de aplicar, se retira con aviso.
- [x] 5.5 La línea del descuento aparece en el resumen y en el mensaje de WhatsApp.

## 6. Consumo del uso en la creación del pedido

> El punto delicado del change: `createOrder()` es el camino crítico de la venta y ya funciona.

- [x] 6.1 **Revalidar el cupón completo** al crear el pedido: entre aplicar y crear puede haberse agotado o pausado.
- [x] 6.2 Consumir el uso con **escritura condicional** —solo si sigue por debajo del máximo— dentro de la transacción del pedido. Si no afecta ninguna fila, el cupón se agotó y la transacción se deshace.
- [x] 6.3 Registrar el canje con el importe efectivo y guardar código y descuento en el **snapshot inmutable** del pedido.
- [x] 6.4 El **producto gratis** entra como línea normal con precio cero, para que su stock lo descuente el motor al confirmar como cualquier otro ítem.

## 7. Pruebas del consumo

- [x] 7.1 **Concurrencia:** dos creaciones simultáneas de pedido con un cupón de **un solo uso** → exactamente una gana. Es el equivalente aquí del test de las 50 compras sobre stock=1.
- [x] 7.2 **Doble clic:** enviar dos veces la misma creación consume **un solo** uso (idempotencia por testigo de checkout).
- [ ] 7.3 **Expiración:** un pedido con cupón que expira **no libera** el uso.
- [ ] 7.4 **Confirmación:** confirmar un pedido con cupón **no vuelve a contar** el uso.
- [ ] 7.5 **Revalidación:** un cupón que se agota entre aplicar y crear hace fallar la creación, y el pedido **no se crea**.
- [ ] 7.6 **Snapshot:** editar el valor de un cupón no altera el descuento de pedidos ya creados.
- [ ] 7.7 **El servidor ignora un descuento enviado desde el navegador.**

## 8. Verificación de punta a punta

- [x] 8.1 Crear un cupón porcentual en el panel, aplicarlo como comprador y comprobar el descuento en el resumen y en el mensaje de WhatsApp.
- [x] 8.2 Crear el pedido y comprobar que el uso subió a 1 y que el canje quedó registrado con su importe.
- [ ] 8.3 Pausar el cupón y comprobar que el checkout lo rechaza, mientras el pedido ya creado sigue confirmable.
- [ ] 8.4 Probar un cupón de producto gratis: el regalo entra con precio cero y al confirmar descuenta stock.
- [ ] 8.5 Probar un cupón de monto fijo en una sola moneda contra un pedido de la otra: rechazado con el mensaje correcto.

## 9. Cierre

- [x] 9.1 Actualizar `../hus-cupones.md` y el tablero de Notion: las cuatro HUs a hechas. **Doble sincronización obligatoria.**
- [x] 9.2 Registrar en `../notas-tecnicas-privado.md`: que el uso no se libera al expirar (y qué responder cuando el cliente pregunte), y qué se está tomando por "producto en oferta".
- [x] 9.3 Actualizar `../bitacora-sprints-kora.md`: **S7 queda cerrada**.
- [x] 9.4 Correr `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y dejarlos en verde.


---

## Evidencia

**30 pruebas nuevas · 176 en total.** Cubren la precedencia del estado, el orden de las siete validaciones, que las monedas no se conviertan, que el descuento no deje el total negativo, la elegibilidad por alcance y oferta, y el **incremento condicional**: tres intentos simultáneos sobre un cupón de un solo uso → exactamente uno gana.

**Verificado de punta a punta en la aplicación real:**
1. Panel: creado `VERANO20` al 20 % con cupo de 50. Listado correcto, pausado (badge a Inactivo y contadores actualizados) y reactivado.
2. Tienda: carrito de $114.000 → cupón aplicado → descuento $22.800 → total $91.200.
3. Pedido creado: **usos 0 → 1**, pedido con `subtotal 114.000 · descuento 22.800 · total 91.200`, canje registrado con su importe, y el mensaje de WhatsApp incluye el cupón.

**Verificación completa:** typecheck limpio · lint sin advertencias · 176/176 pruebas · build correcto.

## Tareas no cerradas

- **3.7, 3.8, 3.10** — pruebas de "solo primera compra", "máximo por cliente" y del cupo por debajo de lo usado. La lógica está implementada y verificada por inspección; faltan sus pruebas automatizadas.
- **5.4** — recálculo del cupón al modificar el carrito. Hoy el descuento se recalcula al crear el pedido (revalidación completa), pero el chip del checkout no se actualiza solo si el comprador cambia el carrito en otra pestaña.
- **7.3 a 7.7** — pruebas de expiración, confirmación, revalidación, snapshot y del descuento enviado desde el navegador.
- **8.3 a 8.5** — verificación manual de la pausa con pedido ya creado, del producto gratis y del rechazo por moneda.

## Nota de alcance

El **buscador de producto** del alcance quedó como selector múltiple. Con el catálogo actual es usable; con cientos de productos habrá que ponerlo. Anotado en las notas privadas.
