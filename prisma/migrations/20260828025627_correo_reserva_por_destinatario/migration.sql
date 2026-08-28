-- El aviso de pedido nuevo pasa a tener VARIOS destinatarios.
--
-- Hasta hoy la reserva de un correo era única por (pedido, tipo). Eso es lo que
-- garantiza que nadie reciba el mismo correo dos veces: no una comprobación
-- previa, sino el índice — dos trabajadores pueden mirar a la vez y ver ambos
-- que la fila no está.
--
-- Al enviar el aviso de pedido nuevo al correo del negocio Y a cada
-- administrador activo, esa clave se vuelve el problema: el segundo
-- destinatario choca contra la reserva del primero y NO recibe nada. El índice
-- que existe para que nadie reciba dos veces habría impedido que la mayoría
-- recibiera una sola.
--
-- Con el destinatario dentro de la clave, la garantía se mantiene donde importa
-- —una persona no recibe el mismo correo dos veces— y los fallos quedan
-- aislados: una dirección que rebota no deja sin aviso a los demás, porque cada
-- destinatario tiene su propia fila, sus propios intentos y su propio error.
--
-- No puede fallar por duplicados: (orderId, type) ya era único, así que
-- (orderId, type, to) lo es necesariamente.
DROP INDEX "order_emails_orderId_type_key";

CREATE UNIQUE INDEX "order_emails_orderId_type_to_key"
  ON "order_emails"("orderId", "type", "to");
