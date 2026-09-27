# Cambios de esquema explícitos

El servidor no ejecuta sync, alter, force ni migraciones al arrancar, en ningún entorno.
Se conserva el mecanismo existente: archivos SQL versionados, aplicados manualmente.
Prisma tiene un schema separado, pero no hay historial de migraciones Prisma; no usar
`db push` para sincronizarlo con esta aplicación Sequelize.

Antes de aplicar 20260927-auth-email-unique.sql, respaldar la BD y revisar:

```sql
SELECT lower(btrim(correo)) AS email_normalizado, count(*)
FROM users GROUP BY lower(btrim(correo)) HAVING count(*) > 1;
```

Si devuelve filas, detener el despliegue y revisar las cuentas manualmente. El código
rechaza el login ambiguo; no elige una cuenta arbitrariamente. La migración no fusiona,
elimina ni normaliza filas. Añade solamente un índice único y puede bloquear escrituras
mientras se construye; aplicarlo en una ventana de mantenimiento. Registrar su aplicación
en el despliegue. Aplicar antes del código para proteger registros concurrentes.

No se requiere cambiar longitudes de columnas ni hashes. Las nuevas entradas usan
los límites actuales de Sequelize: nombre/apellidos 30, correo 50. Verificar que el
esquema existente contiene las tablas/columnas de los modelos; el arranque ya no las crea.
La migración de PayPal existente no se modifica ni se aplica como parte de esta fase.

Rate limiting: no se encontró protección en el código/configuración versionada.
Verificar reglas externas del proveedor antes de añadir otra. Para serverless, preferir
reglas de infraestructura o un limitador con estado compartido por IP y cuenta,
incluyendo login, registro y cambio de contraseña; no usar contadores en memoria.
