-- Aplicación manual, después de revisar duplicados. No modifica filas.
-- Si existen duplicados normalizados, el índice falla y la transacción se revierte.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_normalizado_unique
  ON usuarios (lower(btrim(email)));
COMMIT;
