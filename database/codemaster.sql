-- =====================================================================
-- CodeMaster - Esquema de base de datos (MySQL 8)
--
-- Basado en el modelo codemaster.mwb. Se conservan los nombres de
-- tablas y columnas del modelo, con estas correcciones:
--   * AUTO_INCREMENT en rol, classrom, stadistic y RANKING.
--   * users con llave primaria simple (id); rol_idROLES queda como FK
--     (borrar un rol ya no borra en cascada a sus usuarios).
--   * Código fuente en TEXT: challenge.code_user, challenge.code_teacher
--     y stadistic.CODIGO (antes VARCHAR(45)).
--   * stadistic y RANKING se relacionan con users (users_id).
--   * Métricas de stadistic numéricas (TIEMPO, LINEAS_CODIGO,
--     COMPILACIONES) y una sola fila por usuario y reto.
--   * stadistic.idRANKING admite NULL: la estadística existe antes de
--     que haya un ranking.
--   * classrom_has_users: FK a users solo por id; users_rol_idROLES
--     pasa a ser el rol del usuario dentro del salón (FK a rol).
--   * Las tablas intermedias se borran en cascada con usuario/estadística.
--   * created_at / updated_at se llenan automáticamente.
--   * Se omiten las tablas internas de Laravel y la plantilla
--     "timestamps" de Workbench.
--
-- Agregado para la app móvil (cursos, interacción y gamificación):
--   * classrom es la tabla de cursos (nombre, descripción, creador,
--     público/privado, código de acceso). Se quitaron RETOS, CLASSROMScol
--     y challenge_id; los retos del curso van en classrom_has_challenge.
--   * Likes, comentarios y guardados de cursos; guardados de retos.
--   * challenge_test: casos de prueba para calificar las soluciones.
--   * stadistic: RESUELTO, PUNTOS (dificultad x 100) y FECHA_RESUELTO.
--   * achievement / users_has_achievement (logros) y notification.
-- La migración equivalente para una BD existente está en
-- migracion_cursos_gamificacion.sql.
--
-- Catálogos y autoría (migracion_catalogos_autoria.sql):
--   * dificultad y lenguaje: los nombres, puntos, medallas, plantillas y
--     compiladores que muestra la app salen de estas tablas.
--   * challenge.users_id: autor del reto; solo él puede editarlo o
--     eliminarlo (los retos sin autor los administra un admin).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS codemaster DEFAULT CHARACTER SET utf8mb4;
USE codemaster;

-- ---------------------------------------------------------------------
-- Roles del sistema
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rol (
  idROLES INT NOT NULL AUTO_INCREMENT,
  tipo_rol VARCHAR(45) NOT NULL,
  PRIMARY KEY (idROLES),
  UNIQUE KEY rol_tipo_rol_unique (tipo_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Usuarios (administradores, docentes y estudiantes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  email_verified_at TIMESTAMP NULL DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  remember_token VARCHAR(100) NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  rol_idROLES INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  KEY fk_users_rol1_idx (rol_idROLES),
  CONSTRAINT fk_users_rol1 FOREIGN KEY (rol_idROLES)
    REFERENCES rol (idROLES) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Catálogos: niveles de dificultad y lenguajes del editor
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dificultad (
  nivel INT NOT NULL,
  nombre VARCHAR(45) NOT NULL,
  puntos INT UNSIGNED NOT NULL COMMENT 'Puntos por resolver un reto de este nivel',
  medalla VARCHAR(20) NOT NULL COMMENT 'Medalla que se gana: bronce, plata u oro',
  PRIMARY KEY (nivel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lenguaje (
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

-- ---------------------------------------------------------------------
-- Retos de programación
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS challenge (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  difficulty INT NOT NULL COMMENT '1 = fácil, 2 = media, 3 = difícil',
  lenguage VARCHAR(20) NOT NULL COMMENT 'Clave del lenguaje: python, java, c, cpp, javascript',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  code_user TEXT NULL COMMENT 'Código inicial que ve el estudiante en el editor',
  code_teacher TEXT NOT NULL COMMENT 'Solución del docente',
  users_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Creador del reto (NULL = reto de ejemplo, lo administra un admin)',
  PRIMARY KEY (id),
  KEY fk_challenge_users1_idx (users_id),
  KEY fk_challenge_dificultad1_idx (difficulty),
  KEY fk_challenge_lenguaje1_idx (lenguage),
  CONSTRAINT fk_challenge_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_challenge_dificultad1 FOREIGN KEY (difficulty)
    REFERENCES dificultad (nivel) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_challenge_lenguaje1 FOREIGN KEY (lenguage)
    REFERENCES lenguaje (clave) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Cursos (salones). Los privados se unen con access_code
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classrom (
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

-- ---------------------------------------------------------------------
-- Estadísticas de cada estudiante en cada reto (una fila por usuario y
-- reto, se actualiza en cada compilación)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stadistic (
  idstadistic INT NOT NULL AUTO_INCREMENT,
  TIEMPO DECIMAL(10,3) NOT NULL DEFAULT 0 COMMENT 'Tiempo (s) que tardó la última compilación y ejecución',
  CODIGO TEXT NOT NULL COMMENT 'Último código fuente compilado',
  LINEAS_CODIGO INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Líneas no vacías del último código',
  COMPILACIONES INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Cantidad de compilaciones enviadas',
  RESUELTO TINYINT(1) NOT NULL DEFAULT 0,
  PUNTOS INT UNSIGNED NOT NULL DEFAULT 0,
  FECHA_RESUELTO TIMESTAMP NULL DEFAULT NULL,
  idRANKING INT NULL DEFAULT NULL,
  challenge_id BIGINT UNSIGNED NOT NULL,
  users_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (idstadistic, challenge_id),
  UNIQUE KEY stadistic_users_challenge_unique (users_id, challenge_id),
  KEY fk_stadistic_challenge1_idx (challenge_id),
  CONSTRAINT fk_stadistic_challenge1 FOREIGN KEY (challenge_id)
    REFERENCES challenge (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_stadistic_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Ranking
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS RANKING (
  idRANKING INT NOT NULL AUTO_INCREMENT,
  CODIGO VARCHAR(45) NOT NULL,
  LUGAR VARCHAR(45) NOT NULL,
  users_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (idRANKING),
  KEY fk_RANKING_users1_idx (users_id),
  CONSTRAINT fk_RANKING_users1 FOREIGN KEY (users_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Relación estadística <-> ranking (N:M)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stadistic_has_RANKING (
  stadistic_idstadistic INT NOT NULL,
  stadistic_challenge_id BIGINT UNSIGNED NOT NULL,
  RANKING_idRANKING INT NOT NULL,
  PRIMARY KEY (stadistic_idstadistic, stadistic_challenge_id, RANKING_idRANKING),
  KEY fk_stadistic_has_RANKING_RANKING1_idx (RANKING_idRANKING),
  KEY fk_stadistic_has_RANKING_stadistic1_idx (stadistic_idstadistic, stadistic_challenge_id),
  CONSTRAINT fk_stadistic_has_RANKING_stadistic1 FOREIGN KEY (stadistic_idstadistic, stadistic_challenge_id)
    REFERENCES stadistic (idstadistic, challenge_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_stadistic_has_RANKING_RANKING1 FOREIGN KEY (RANKING_idRANKING)
    REFERENCES RANKING (idRANKING) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Relación curso <-> usuarios (N:M), con el rol del usuario en el curso
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classrom_has_users (
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
CREATE TABLE IF NOT EXISTS classrom_has_challenge (
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
CREATE TABLE IF NOT EXISTS classrom_like (
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

CREATE TABLE IF NOT EXISTS classrom_comment (
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

CREATE TABLE IF NOT EXISTS classrom_saved (
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

CREATE TABLE IF NOT EXISTS challenge_saved (
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
CREATE TABLE IF NOT EXISTS challenge_test (
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
-- Logros y notificaciones
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievement (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL COMMENT 'Nombre del ícono de Material Icons',
  PRIMARY KEY (id),
  UNIQUE KEY achievement_code_unique (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users_has_achievement (
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

CREATE TABLE IF NOT EXISTS notification (
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
INSERT IGNORE INTO rol (idROLES, tipo_rol) VALUES
  (1, 'admin'),
  (2, 'docente'),
  (3, 'estudiante');

INSERT IGNORE INTO dificultad (nivel, nombre, puntos, medalla) VALUES
  (1, 'Fácil', 100, 'bronce'),
  (2, 'Media', 200, 'plata'),
  (3, 'Difícil', 300, 'oro');

INSERT IGNORE INTO lenguaje (clave, nombre, monaco, wandbox_lenguaje, wandbox_prefijo, wandbox_defecto, plantilla, orden) VALUES
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

-- Nota: dentro de los textos, \\n es un salto de línea del programa y
-- \' una comilla simple (MySQL interpreta las barras invertidas).
INSERT IGNORE INTO challenge (id, name, description, difficulty, lenguage, code_user, code_teacher) VALUES
(1,
 'Suma de dos números',
 'Lee dos números enteros de la entrada estándar (separados por espacio o salto de línea) e imprime su suma.',
 1,
 'c',
 '#include <stdio.h>

int main(void) {
    int a, b;
    /* Lee los dos números e imprime su suma */

    return 0;
}
',
 '#include <stdio.h>

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a + b);
    return 0;
}
'),
(2,
 'Algoritmos de Ordenamiento',
 'Implementa Merge Sort. La primera línea de la entrada trae n y la segunda n enteros separados por espacio. Imprime los números ordenados de menor a mayor, separados por espacio.',
 2,
 'python',
 'def merge_sort(lista):
    # Implementa Merge Sort aquí
    return lista


n = int(input())
numeros = list(map(int, input().split()))
print(*merge_sort(numeros))
',
 'def merge_sort(lista):
    if len(lista) <= 1:
        return lista
    mitad = len(lista) // 2
    izquierda = merge_sort(lista[:mitad])
    derecha = merge_sort(lista[mitad:])
    resultado = []
    i = j = 0
    while i < len(izquierda) and j < len(derecha):
        if izquierda[i] <= derecha[j]:
            resultado.append(izquierda[i])
            i += 1
        else:
            resultado.append(derecha[j])
            j += 1
    resultado.extend(izquierda[i:])
    resultado.extend(derecha[j:])
    return resultado


n = int(input())
numeros = list(map(int, input().split()))
print(*merge_sort(numeros))
'),
(3,
 'Estructuras de Datos Avanzadas',
 'Crea un árbol AVL. La primera línea trae n y la segunda n enteros a insertar. Imprime el recorrido inorden y, en otra línea, la altura final del árbol.',
 3,
 'java',
 'import java.util.Scanner;

public class Main {
    static class Nodo {
        int valor, altura = 1;
        Nodo izquierdo, derecho;
        Nodo(int valor) { this.valor = valor; }
    }

    static Nodo insertar(Nodo nodo, int valor) {
        // Inserta el valor y rebalancea el árbol con rotaciones
        return nodo;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        Nodo raiz = null;
        for (int i = 0; i < n; i++) {
            raiz = insertar(raiz, sc.nextInt());
        }
        // Imprime el recorrido inorden y la altura del árbol
    }
}
',
 'import java.util.Scanner;

public class Main {
    static class Nodo {
        int valor, altura = 1;
        Nodo izquierdo, derecho;
        Nodo(int valor) { this.valor = valor; }
    }

    static int altura(Nodo n) { return n == null ? 0 : n.altura; }

    static void actualizar(Nodo n) {
        n.altura = 1 + Math.max(altura(n.izquierdo), altura(n.derecho));
    }

    static Nodo rotarDerecha(Nodo y) {
        Nodo x = y.izquierdo;
        y.izquierdo = x.derecho;
        x.derecho = y;
        actualizar(y);
        actualizar(x);
        return x;
    }

    static Nodo rotarIzquierda(Nodo x) {
        Nodo y = x.derecho;
        x.derecho = y.izquierdo;
        y.izquierdo = x;
        actualizar(x);
        actualizar(y);
        return y;
    }

    static Nodo insertar(Nodo nodo, int valor) {
        if (nodo == null) return new Nodo(valor);
        if (valor < nodo.valor) nodo.izquierdo = insertar(nodo.izquierdo, valor);
        else if (valor > nodo.valor) nodo.derecho = insertar(nodo.derecho, valor);
        else return nodo;

        actualizar(nodo);
        int balance = altura(nodo.izquierdo) - altura(nodo.derecho);

        if (balance > 1 && valor < nodo.izquierdo.valor) return rotarDerecha(nodo);
        if (balance < -1 && valor > nodo.derecho.valor) return rotarIzquierda(nodo);
        if (balance > 1 && valor > nodo.izquierdo.valor) {
            nodo.izquierdo = rotarIzquierda(nodo.izquierdo);
            return rotarDerecha(nodo);
        }
        if (balance < -1 && valor < nodo.derecho.valor) {
            nodo.derecho = rotarDerecha(nodo.derecho);
            return rotarIzquierda(nodo);
        }
        return nodo;
    }

    static void inorden(Nodo n, StringBuilder sb) {
        if (n == null) return;
        inorden(n.izquierdo, sb);
        sb.append(n.valor).append(\' \');
        inorden(n.derecho, sb);
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        Nodo raiz = null;
        for (int i = 0; i < n; i++) {
            raiz = insertar(raiz, sc.nextInt());
        }
        StringBuilder sb = new StringBuilder();
        inorden(raiz, sb);
        System.out.println(sb.toString().trim());
        System.out.println("Altura: " + altura(raiz));
    }
}
');

-- Si el script se ejecuta con una herramienta que conserva los saltos de línea de
-- Windows (\r\n), el código de ejemplo queda solo con \n
UPDATE challenge
SET code_user = REPLACE(code_user, CHAR(13), ''),
    code_teacher = REPLACE(code_teacher, CHAR(13), '')
WHERE id IN (1, 2, 3);

INSERT IGNORE INTO achievement (id, code, name, description, icon) VALUES
  (1, 'primera_compilacion', 'Hola, mundo', 'Ejecuta tu primer programa en un reto', 'waving_hand'),
  (2, 'diez_compilaciones', 'Persistente', 'Compila 10 veces en los retos', 'replay'),
  (3, 'primer_reto', 'Primer reto', 'Resuelve tu primer reto', 'flag'),
  (4, 'tres_retos', 'Imparable', 'Resuelve 3 retos', 'local_fire_department'),
  (5, 'reto_dificil', 'Sin miedo', 'Resuelve un reto difícil', 'psychology'),
  (6, 'primer_curso', 'Compañero de clase', 'Únete a un curso', 'school'),
  (7, 'primer_comentario', 'Participativo', 'Comenta en un curso', 'forum'),
  (8, 'creador', 'Mentor', 'Crea un curso', 'workspace_premium');

-- Casos de prueba de los retos de ejemplo (aquí \n sí es un salto de línea)
INSERT INTO challenge_test (challenge_id, input, expected_output)
SELECT reto, entrada, salida FROM (
  SELECT 1 AS reto, '4 5' AS entrada, '9' AS salida UNION ALL
  SELECT 1, '-7\n20', '13' UNION ALL
  SELECT 2, '6\n5 2 9 1 5 6', '1 2 5 5 6 9' UNION ALL
  SELECT 2, '1\n42', '42' UNION ALL
  SELECT 3, '7\n10 20 30 40 50 25 5', '5 10 20 25 30 40 50\nAltura: 4' UNION ALL
  SELECT 3, '3\n1 2 3', '1 2 3\nAltura: 2'
) AS casos
WHERE NOT EXISTS (SELECT 1 FROM challenge_test);
