# Tareas — dashboard con datos reales

- [x] 1.1 `src/modules/dashboard/queries.ts`: ventas por día de los últimos siete, agregadas en la base, **reutilizando el predicado de "confirmado"** del módulo de clientes.
- [x] 1.2 Top de productos por **unidades vendidas** en pedidos confirmados.
- [x] 2.1 Prueba: un pedido pendiente y uno cancelado **no** entran en ninguna de las dos.
- [x] 2.2 Prueba: un pedido entregado **sí** cuenta.
- [x] 2.3 Prueba: los siete días se devuelven siempre, con cero donde no hubo ventas.
- [x] 2.4 Prueba: el top ordena por unidades y no por destacado.
- [x] 3.1 Sustituir la gráfica falsa por la real y **retirar la leyenda** de "las ventas llegan en la Semana 8".
- [x] 3.2 Sustituir el top por el real, con estado vacío explícito cuando no hay ventas.
- [x] 4.1 Verificar en la aplicación real contra los pedidos que ya existen.
- [x] 4.2 Actualizar la bitácora: S11 avanza; los informes siguen pendientes de HUs.
- [x] 4.3 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.


---

## Evidencia

**8 pruebas nuevas · 184 en total.** Fijan que pendientes y cancelados no sumen, que un entregado sí, que los siete días se devuelvan siempre y que las monedas no se mezclen.

**Verificado de punta a punta:** el top pasó a mostrar unidades realmente vendidas (`Billetera minimalista · 3 unidades · $199.200`). La gráfica mostraba cero en los siete días — y era **correcto**: los dos pedidos confirmados eran del 20 de julio, hace doce días. Al confirmar desde el panel el pedido con cupón, la gráfica reaccionó con **$91.200 el viernes**, que es el total ya descontado, es decir lo que el cliente paga.

Retirada la leyenda *"Las ventas llegan con los pedidos (Semana 8)"*, que llevaba obsoleta desde que la tienda empezó a vender.
