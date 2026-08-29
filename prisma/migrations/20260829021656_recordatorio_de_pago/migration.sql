-- El octavo correo del pedido: recordatorio de pago antes de que expire.
--
-- Es el único que NO nace de un cambio de estado. A una hora de vencer, el
-- pedido sigue siendo el mismo —PENDING— y sin embargo hay algo que decirle al
-- comprador. Por eso no se dispara desde la máquina de estados sino desde un
-- trabajo programado.
--
-- Añadir un valor a un enum de PostgreSQL no reescribe la tabla ni bloquea:
-- las filas existentes no se tocan.
ALTER TYPE "OrderEmailType" ADD VALUE 'BUYER_PAYMENT_REMINDER';
