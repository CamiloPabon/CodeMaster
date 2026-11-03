-- =====================================================================
-- Migración única: pasa las cuentas de auth_users a users y elimina las
-- tablas anteriores (auth_users y usuarios).
--
-- Ejecutar DESPUÉS de codemaster.sql y con un backup previo:
--   mysqldump -u root -p --databases codemaster > backup.sql
-- =====================================================================
USE codemaster;

-- Conserva id, nombre, correo y el hash bcrypt de la contraseña, así que
-- cada usuario sigue entrando con la misma contraseña.
-- rol 'admin' -> admin, cualquier otro -> estudiante.
INSERT INTO users (id, name, email, password, rol_idROLES)
SELECT a.id,
       a.nombre,
       a.correo,
       a.password,
       (SELECT r.idROLES FROM rol r
         WHERE r.tipo_rol = IF(a.rol = 'admin', 'admin', 'estudiante'))
FROM auth_users a
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = a.correo);

-- usuarios era la tabla de la demo del CRUD (sin contraseñas): no se migra.
DROP TABLE IF EXISTS auth_users;
DROP TABLE IF EXISTS usuarios;
