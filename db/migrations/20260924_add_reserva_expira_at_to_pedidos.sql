-- Ejecutar una sola vez sobre petshop_ecommerce, después del esquema inicial.
-- Los pedidos anteriores quedan con NULL: no tenían una reserva temporizada.
-- El futuro endpoint de pedidos deberá asignar explícitamente el vencimiento.
ALTER TABLE pedidos
    ADD COLUMN reserva_expira_at TIMESTAMP NULL DEFAULT NULL AFTER fecha_pedido;
