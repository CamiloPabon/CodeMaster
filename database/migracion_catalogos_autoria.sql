-- =====================================================================
-- Migración: catálogos en la base de datos y autor de cada reto
--
-- Ejecutar DESPUÉS de migracion_cursos_gamificacion.sql, con un backup
-- previo. Se ejecuta una sola vez.
--
--   * dificultad: nombre, puntos y medalla de cada nivel (antes estaban
--     escritos en el código de la web y del backend).
--   * lenguaje: lenguajes del editor, su plantilla y su compilador en
--     Wandbox (antes en config/languages.js).
--   * challenge.users_id: quién creó el reto. Solo esa persona puede
--     editarlo o eliminarlo. Los retos sin autor (los de ejemplo) los
--     administra un admin; si se borra la cuenta del autor, el reto queda
--     sin autor en vez de borrarse.
--   * challenge.difficulty y challenge.lenguage pasan a ser llaves
--     foráneas hacia los catálogos.
-- =====================================================================
USE codemaster;

CREATE TABLE dificultad (
  nivel INT NOT NULL,
  nombre VARCHAR(45) NOT NULL,
  puntos INT UNSIGNED NOT NULL COMMENT 'Puntos por resolver un reto de este nivel',
  medalla VARCHAR(20) NOT NULL COMMENT 'Medalla que se gana: bronce, plata u oro',
  PRIMARY KEY (nivel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lenguaje (
  clave VARCHAR(20) NOT NULL COMMENT 'Valor que se guarda en challenge.lenguage',
  nombre VARCHAR(45) NOT NULL,
  monaco VARCHAR(30) NOT NULL COMMENT 'Resaltado de sintaxis en el editor',
  wandbox_lenguaje VARCHAR(45) NOT NULL COMMENT 'Campo language en GET /api/list.json de Wandbox',
  wandbox_prefijo VARCHAR(45) NOT NULL COMMENT 'Prefijo del compilador; se usa la versión estable más reciente',
  wandbox_defecto VARCHAR(60) NOT NULL COMMENT 'Compilador a usar si no se puede consultar la lista',
  plantilla TEXT NOT NULL COMMENT 'Código inicial del editor libre',
  orden INT NOT NULL DEFAULT 0,
  PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO dificultad (nivel, nombre, puntos, medalla) VALUES
  (1, 'Fácil', 100, 'bronce'),
  (2, 'Media', 200, 'plata'),
  (3, 'Difícil', 300, 'oro');

-- \\n dentro del texto es un salto de línea del programa (MySQL interpreta las barras)
INSERT INTO lenguaje (clave, nombre, monaco, wandbox_lenguaje, wandbox_prefijo, wandbox_defecto, plantilla, orden) VALUES
('python', 'Python 3', 'python', 'Python', 'cpython-3.', 'cpython-3.13.8',
'print("Hola, CodeMaster!")
', 1),
('java', 'Java', 'java', 'Java', 'openjdk-', 'openjdk-jdk-22+36',
'public class Main {
    public static void main(String[] args) {
        System.out.println("Hola, CodeMaster!");
    }
}
', 2),
('c', 'C', 'c', 'C', 'gcc-', 'gcc-13.2.0-c',
'#include <stdio.h>

int main(void) {
    printf("Hola, CodeMaster!\\n");
    return 0;
}
', 3),
('cpp', 'C++', 'cpp', 'C++', 'gcc-', 'gcc-13.2.0',
'#include <iostream>
using namespace std;

int main() {
    cout << "Hola, CodeMaster!" << endl;
    return 0;
}
', 4),
('javascript', 'JavaScript (Node.js)', 'javascript', 'JavaScript', 'nodejs-', 'nodejs-20.17.0',
'console.log("Hola, CodeMaster!");
', 5);

UPDATE lenguaje SET plantilla = REPLACE(plantilla, CHAR(13), '');

ALTER TABLE challenge
  ADD COLUMN users_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Creador del reto (NULL = reto de ejemplo, lo administra un admin)' AFTER code_teacher,
  ADD KEY fk_challenge_users1_idx (users_id),
  ADD KEY fk_challenge_dificultad1_idx (difficulty),
  ADD KEY fk_challenge_lenguaje1_idx (lenguage),
  ADD CONSTRAINT fk_challenge_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_challenge_dificultad1 FOREIGN KEY (difficulty)
    REFERENCES dificultad (nivel) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_challenge_lenguaje1 FOREIGN KEY (lenguage)
    REFERENCES lenguaje (clave) ON DELETE RESTRICT ON UPDATE CASCADE;
