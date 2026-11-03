-- =====================================================================
-- Migración: cursos, interacción social y gamificación (app móvil)
--
-- Ejecutar DESPUÉS de codemaster.sql, con un backup previo. Se puede
-- ejecutar una sola vez (classrom se reconstruye; debe estar vacía).
--
--   * classrom pasa a ser la tabla de cursos: nombre, descripción,
--     creador, público/privado y código de acceso. Se quitan RETOS,
--     CLASSROMScol y challenge_id; los retos del curso van en
--     classrom_has_challenge.
--   * Likes, comentarios y guardados de cursos; guardados de retos.
--   * Casos de prueba por reto (challenge_test) para calificar.
--   * stadistic: RESUELTO, PUNTOS y FECHA_RESUELTO (ranking y medallas).
--   * Logros (achievement / users_has_achievement) y notificaciones.
-- =====================================================================
USE codemaster;

-- ---------------------------------------------------------------------
-- Cursos (classrom corregida). Se reconstruye junto con su relación con
-- usuarios porque la llave primaria cambia; ambas tablas están vacías.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS classrom_has_users;
DROP TABLE IF EXISTS classrom;

CREATE TABLE classrom (
  idCLASSROMS INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(500) NULL DEFAULT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  access_code VARCHAR(10) NULL DEFAULT NULL COMMENT 'Código para unirse a un curso privado',
  users_id BIGINT UNSIGNED NOT NULL COMMENT 'Creador del curso',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (idCLASSROMS),
  KEY fk_classrom_users1_idx (users_id),
  CONSTRAINT fk_classrom_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE classrom_has_users (
  classrom_idCLASSROMS INT NOT NULL,
  users_id BIGINT UNSIGNED NOT NULL,
  users_rol_idROLES INT NOT NULL COMMENT 'Rol del usuario dentro del curso',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (classrom_idCLASSROMS, users_id),
  KEY fk_classrom_has_users_users1_idx (users_id),
  KEY fk_classrom_has_users_rol1_idx (users_rol_idROLES),
  CONSTRAINT fk_classrom_has_users_classrom1 FOREIGN KEY (classrom_idCLASSROMS)
    REFERENCES classrom (idCLASSROMS) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_classrom_has_users_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_classrom_has_users_rol1 FOREIGN KEY (users_rol_idROLES)
    REFERENCES rol (idROLES) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Retos de cada curso (N:M)
CREATE TABLE classrom_has_challenge (
  classrom_idCLASSROMS INT NOT NULL,
  challenge_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (classrom_idCLASSROMS, challenge_id),
  KEY fk_classrom_has_challenge_challenge1_idx (challenge_id),
  CONSTRAINT fk_classrom_has_challenge_classrom1 FOREIGN KEY (classrom_idCLASSROMS)
    REFERENCES classrom (idCLASSROMS) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_classrom_has_challenge_challenge1 FOREIGN KEY (challenge_id)
    REFERENCES challenge (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Interacción con los cursos: likes, comentarios y guardados
-- ---------------------------------------------------------------------
CREATE TABLE classrom_like (
  users_id BIGINT UNSIGNED NOT NULL,
  classrom_idCLASSROMS INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (users_id, classrom_idCLASSROMS),
  KEY fk_classrom_like_classrom1_idx (classrom_idCLASSROMS),
  CONSTRAINT fk_classrom_like_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_classrom_like_classrom1 FOREIGN KEY (classrom_idCLASSROMS)
    REFERENCES classrom (idCLASSROMS) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE classrom_comment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  classrom_idCLASSROMS INT NOT NULL,
  users_id BIGINT UNSIGNED NOT NULL,
  content VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_classrom_comment_classrom1_idx (classrom_idCLASSROMS),
  KEY fk_classrom_comment_users1_idx (users_id),
  CONSTRAINT fk_classrom_comment_classrom1 FOREIGN KEY (classrom_idCLASSROMS)
    REFERENCES classrom (idCLASSROMS) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_classrom_comment_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE classrom_saved (
  users_id BIGINT UNSIGNED NOT NULL,
  classrom_idCLASSROMS INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (users_id, classrom_idCLASSROMS),
  KEY fk_classrom_saved_classrom1_idx (classrom_idCLASSROMS),
  CONSTRAINT fk_classrom_saved_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_classrom_saved_classrom1 FOREIGN KEY (classrom_idCLASSROMS)
    REFERENCES classrom (idCLASSROMS) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE challenge_saved (
  users_id BIGINT UNSIGNED NOT NULL,
  challenge_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (users_id, challenge_id),
  KEY fk_challenge_saved_challenge1_idx (challenge_id),
  CONSTRAINT fk_challenge_saved_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_challenge_saved_challenge1 FOREIGN KEY (challenge_id)
    REFERENCES challenge (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Casos de prueba de cada reto (para "Enviar solución")
-- ---------------------------------------------------------------------
CREATE TABLE challenge_test (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  challenge_id BIGINT UNSIGNED NOT NULL,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY fk_challenge_test_challenge1_idx (challenge_id),
  CONSTRAINT fk_challenge_test_challenge1 FOREIGN KEY (challenge_id)
    REFERENCES challenge (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Ranking y medallas: un reto resuelto da PUNTOS = dificultad x 100
-- ---------------------------------------------------------------------
ALTER TABLE stadistic
  ADD COLUMN RESUELTO TINYINT(1) NOT NULL DEFAULT 0 AFTER COMPILACIONES,
  ADD COLUMN PUNTOS INT UNSIGNED NOT NULL DEFAULT 0 AFTER RESUELTO,
  ADD COLUMN FECHA_RESUELTO TIMESTAMP NULL DEFAULT NULL AFTER PUNTOS;

-- ---------------------------------------------------------------------
-- Logros y notificaciones
-- ---------------------------------------------------------------------
CREATE TABLE achievement (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL COMMENT 'Nombre del ícono de Material Icons',
  PRIMARY KEY (id),
  UNIQUE KEY achievement_code_unique (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users_has_achievement (
  users_id BIGINT UNSIGNED NOT NULL,
  achievement_id INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (users_id, achievement_id),
  KEY fk_users_has_achievement_achievement1_idx (achievement_id),
  CONSTRAINT fk_users_has_achievement_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_users_has_achievement_achievement1 FOREIGN KEY (achievement_id)
    REFERENCES achievement (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notification (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  users_id BIGINT UNSIGNED NOT NULL COMMENT 'Destinatario',
  type VARCHAR(30) NOT NULL COMMENT 'like, comentario, union, logro, reto, resuelto',
  message VARCHAR(255) NOT NULL,
  link VARCHAR(100) NULL DEFAULT NULL COMMENT 'Ruta del frontend, ej: /curso/3',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_notification_users1_idx (users_id, is_read),
  CONSTRAINT fk_notification_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- Datos iniciales
-- =====================================================================
INSERT IGNORE INTO achievement (id, code, name, description, icon) VALUES
  (1, 'primera_compilacion', 'Hola, mundo', 'Ejecuta tu primer programa en un reto', 'waving_hand'),
  (2, 'diez_compilaciones', 'Persistente', 'Compila 10 veces en los retos', 'replay'),
  (3, 'primer_reto', 'Primer reto', 'Resuelve tu primer reto', 'flag'),
  (4, 'tres_retos', 'Imparable', 'Resuelve 3 retos', 'local_fire_department'),
  (5, 'reto_dificil', 'Sin miedo', 'Resuelve un reto difícil', 'psychology'),
  (6, 'primer_curso', 'Compañero de clase', 'Únete a un curso', 'school'),
  (7, 'primer_comentario', 'Participativo', 'Comenta en un curso', 'forum'),
  (8, 'creador', 'Mentor', 'Crea un curso', 'workspace_premium');

-- Casos de prueba de los retos de ejemplo (\n = salto de línea en la entrada/salida)
INSERT INTO challenge_test (challenge_id, input, expected_output)
SELECT reto, entrada, salida FROM (
  SELECT 1 AS reto, '4 5' AS entrada, '9' AS salida UNION ALL
  SELECT 1, '-7\n20', '13' UNION ALL
  SELECT 2, '6\n5 2 9 1 5 6', '1 2 5 5 6 9' UNION ALL
  SELECT 2, '1\n42', '42' UNION ALL
  SELECT 3, '7\n10 20 30 40 50 25 5', '5 10 20 25 30 40 50\nAltura: 4' UNION ALL
  SELECT 3, '3\n1 2 3', '1 2 3\nAltura: 2'
) AS casos
WHERE EXISTS (SELECT 1 FROM challenge WHERE id = 3)
  AND NOT EXISTS (SELECT 1 FROM challenge_test);
