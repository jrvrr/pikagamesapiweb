-- Create the missing Secondary modality for every game that already has a
-- Principal product. Stock is legacy metadata; active products are unlimited.
INSERT INTO productos_videojuego (
  videojuego_id, tipo_cuenta, precio, stock, activo, created_at
)
SELECT principal.videojuego_id, 'secundaria', 260.00, 0, principal.activo, NOW()
FROM productos_videojuego AS principal
WHERE principal.tipo_cuenta = 'principal'
  AND NOT EXISTS (
    SELECT 1
    FROM productos_videojuego AS secundaria
    WHERE secundaria.videojuego_id = principal.videojuego_id
      AND secundaria.tipo_cuenta = 'secundaria'
  );
