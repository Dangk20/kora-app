-- Un pedido genera COMO MUCHO UN lote de cashback.
--
-- La comprobación del manejador (¿ya hay lote de este pedido?) no es atómica:
-- dos eventos `order.confirmed` del mismo pedido pueden ser tomados por dos
-- trabajadores a la vez, ver ambos "no existe" y acreditar los dos. Aquí lo que
-- se duplicaría es DINERO, y es un error que nadie reporta — nadie se queja de
-- que le den de más. Por eso la garantía vive en la base y no solo en el código.
--
-- Parcial sobre type = 'EARN' y orderId no nulo: los consumos y vencimientos
-- del mismo pedido pueden ser muchos, y un lote sin pedido (ajuste manual) no
-- entra en la restricción.
CREATE UNIQUE INDEX "cashback_un_lote_por_pedido"
  ON "cashback_movements" ("orderId")
  WHERE type = 'EARN' AND "orderId" IS NOT NULL;
