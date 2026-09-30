-- Stock is not part of digital game availability.
ALTER TABLE productos_videojuego DROP COLUMN IF EXISTS stock;
