-- Todos los títulos activos tienen productos digitales para ambas modalidades.
INSERT INTO productos_videojuego (videojuego_id, tipo_cuenta, precio, activo, created_at)
SELECT videojuego.id, modalidad.tipo_cuenta, modalidad.precio, TRUE, NOW()
FROM videojuegos AS videojuego
CROSS JOIN (VALUES ('principal', 650.00), ('secundaria', 260.00)) AS modalidad(tipo_cuenta, precio)
WHERE videojuego.activo = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM productos_videojuego AS producto
    WHERE producto.videojuego_id = videojuego.id
      AND producto.tipo_cuenta = modalidad.tipo_cuenta
  );

-- Stock is not part of digital game availability.
ALTER TABLE productos_videojuego DROP COLUMN IF EXISTS stock;
