## Decisiones

1. **Un campo, no una inferencia.** `deliveryMethod` se guarda explícito. Inferir "recoger" de `shipAddress` nulo dejaría a los pedidos viejos sin dirección leyéndose como recogidas.
2. **Quien recoge vive en `ship*`.** Es la persona a la que se le entrega: misma semántica que el destinatario de un envío. No se crean columnas `pickup*` paralelas que cada consumidor tendría que aprender a leer.
3. **`shipSameAsBilling` sigue significando "misma dirección".** En `PICKUP` vale `false` siempre y los consumidores deciden por `deliveryMethod` primero. "La recojo yo" se resuelve en servidor copiando nombre, celular y documento del pagador (como "mismos datos" en envío): el formulario no manda un segundo juego de campos.
4. **La tienda vive en `orders/tienda-fisica.ts`** con los valores confirmados y el entorno los sobrescribe. Sin guarda de arranque: un valor en blanco no impide vender, solo cambia el texto a "te confirmamos por WhatsApp".
5. **Comprobante:** `delivery` es opcional en el snapshot v2; ausente = `SHIPPING`. No se sube la versión: los v2 emitidos siguen siendo v2 válidos.
6. **La libreta no se estrena con una recogida.** Con `PICKUP` no hay dirección de envío; al cliente se le pasa la dirección del pagador solo si está en Colombia, que es lo que el espejo `customer.city/address` ya representaba.
