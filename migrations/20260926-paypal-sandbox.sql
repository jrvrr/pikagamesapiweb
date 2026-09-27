-- Ejecutar una vez sobre la base Sandbox antes de publicar el código.
-- No elimina ni fusiona datos: los duplicados existentes deben revisarse manualmente.
BEGIN;
ALTER TABLE videojuegos ADD COLUMN IF NOT EXISTS rawg_id BIGINT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS paypal_request_id UUID;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS paypal_capture_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS videojuegos_rawg_id_unique ON videojuegos (rawg_id);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_paypal_request_id_unique ON pagos (paypal_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_paypal_capture_id_unique ON pagos (paypal_capture_id);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_referencia_externa_unique ON pagos (referencia_externa);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_pedido_id_unique ON pagos (pedido_id);
CREATE UNIQUE INDEX IF NOT EXISTS comprobantes_pago_id_unique ON comprobantes (pago_id);
CREATE UNIQUE INDEX IF NOT EXISTS entregas_pedido_id_unique ON entregas (pedido_id);
COMMIT;
