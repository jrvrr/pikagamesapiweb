ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_request_id_unique ON pedidos (request_id);

ALTER TABLE pagos
  ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN ('paypal', 'oxxo', 'transferencia'));
