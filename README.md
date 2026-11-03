# codemaster-backend
backend del proyecto de grado
Descripción:
API REST desarrollada con Node.js y MySQL que permite gestionar usuarios con autenticación mediante JWT, incluyendo control de roles (admin, docente y estudiante), cursos con likes y comentarios, retos de programación calificados con casos de prueba, ranking, medallas, logros, notificaciones y un compilador en línea gratuito (Wandbox) que ejecuta el código de los estudiantes.

El mismo servidor sirve la web y la app móvil (PWA), con el tema visual de la app móvil original:
- Web: http://localhost:3000
- App móvil: http://localhost:3000/movil/ (desde el celular: http://IP_DEL_PC:3000/movil/)

Tecnologías usadas:
- Node.js
- Express
- MySQL
- JWT (jsonwebtoken)
- bcryptjs
- dotenv

Configuración:

1. Clonar proyecto
git clone URL_DEL_PROYECTO
cd codemaster-backend

2. Instalar dependencias
npm install

3. Crear archivo .env

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=codemaster
PORT=3000
JWT_SECRET=miclave123

El compilador (Wandbox) no necesita cuenta, API key ni configuración. Opcional:
WANDBOX_URL=https://wandbox.org   (solo si se usa otra instancia de Wandbox)

4. Ejecutar servidor
node server.js

5. Abrir la web en http://localhost:3000 y la app móvil en http://localhost:3000/movil/

Frontend (carpeta public/):

public/index.html        -> web
public/movil/            -> app móvil: index.html, manifest.webmanifest y sw.js (PWA)
public/app/              -> código compartido por las dos: tema.css, main.js (rutas),
                            api.js, ui.js y vistas/ (una por pantalla)
public/img/              -> logo e íconos (tomados de la app móvil original)

Son módulos de JavaScript sin paso de compilación: basta con editar y recargar.

App móvil en el celular:
- El PC y el celular deben estar en la misma red Wi-Fi. Abrir http://IP_DEL_PC:3000/movil/
  (la IP se ve con ipconfig). Windows puede pedir permiso en el firewall para Node.
- Para instalarla como app (pantalla completa, ícono propio) el navegador exige https o
  localhost. Por la red local funciona normal en el navegador y se puede "Agregar a la
  pantalla de inicio"; al publicar el servidor con https queda instalable como app.

Base de datos:

El esquema completo (tablas, roles, logros, retos de ejemplo y sus casos de prueba) está en
database/codemaster.sql. Se basa en el modelo codemaster.mwb; las correcciones y lo agregado
para la app móvil están al inicio del archivo.

Instalación nueva:
mysql -u root -p --default-character-set=utf8mb4 < database/codemaster.sql

Base de datos existente (en este orden, solo lo que falte):
- Si todavía tiene la tabla auth_users: database/migracion_auth_users.sql
  (pasa las cuentas a users y elimina auth_users y usuarios)
- Si classrom todavía tiene la columna challenge_id: database/migracion_cursos_gamificacion.sql
  (cursos, likes, comentarios, guardados, casos de prueba, logros y notificaciones)
- Si no existen las tablas dificultad y lenguaje: database/migracion_catalogos_autoria.sql
  (catálogos y autor de cada reto)

Todo lo que muestra la app sale de la base de datos: los nombres, puntos y medallas de cada
dificultad (tabla dificultad), los lenguajes con su plantilla y compilador (tabla lenguaje),
los roles, logros, retos, cursos, estadísticas y notificaciones. Lo único externo es la
versión de cada compilador, que se consulta en vivo a Wandbox.

Tablas: rol, users, dificultad, lenguaje, challenge, challenge_test, challenge_saved, classrom (cursos),
classrom_has_users, classrom_has_challenge, classrom_like, classrom_comment,
classrom_saved, stadistic, RANKING, stadistic_has_RANKING, achievement,
users_has_achievement y notification.

Autenticación:

Se usa JWT para proteger rutas.

Header requerido:
Authorization: Bearer TOKEN

Endpoints:

Registro
POST /auth/register

Body:
{
  "nombre": "Usuario",
  "correo": "user@gmail.com",
  "password": "123456"
}

Login
POST /auth/login

Respuesta:
{
  "mensaje": "Login exitoso",
  "token": "JWT_TOKEN"
}

Perfil (usuario autenticado)
GET /auth/profile

Obtener usuarios
GET /usuarios

Requiere token

- Admin ve todos los usuarios
- Los demás solo ven su información

Crear usuario (solo admin)
POST /usuarios

Body:
{
  "nombre": "Docente",
  "correo": "docente@gmail.com",
  "password": "123456",
  "rol": "docente"
}

rol es opcional (admin, docente o estudiante; por defecto estudiante).

Actualizar usuario (solo admin)
PUT /usuarios/:id

Body: { "nombre", "correo", "rol" (opcional) }

Eliminar usuario (solo admin)
DELETE /usuarios/:id

Retos:

Listar retos (incluye autor, nombres de dificultad y lenguaje, y el progreso del usuario)
GET /challenges?q=texto&filtro=pendientes|resueltos|guardados|mios

Niveles de dificultad (nombre, puntos y medalla de la tabla dificultad)
GET /challenges/dificultades

Ver un reto (incluye el último código que compiló el usuario)
GET /challenges/:id

La solución del docente y los casos de prueba solo los ven admin y docente.

Crear reto (admin y docente)
POST /challenges

Body:
{
  "nombre": "Suma de dos números",
  "descripcion": "Lee dos enteros e imprime su suma.",
  "dificultad": 1,
  "lenguaje": "c",
  "codigoInicial": "#include <stdio.h> ...",
  "solucion": "#include <stdio.h> ...",
  "casos": [{ "entrada": "4 5", "salida": "9" }]
}

dificultad: un nivel de la tabla dificultad (1 fácil, 2 media, 3 difícil).
lenguaje: una clave de la tabla lenguaje (python, java, c, cpp o javascript).
casos: entre 1 y 5 casos de prueba (se usan para calificar las soluciones).
Quien crea el reto queda como su autor (challenge.users_id).

Editar reto (solo su autor)
PUT /challenges/:id   Body: el mismo de crear; reemplaza los datos y los casos de prueba.
Si ya hay estudiantes con intentos no se puede cambiar el lenguaje.

Eliminar reto (solo su autor)
DELETE /challenges/:id
Se borran también sus casos de prueba, las estadísticas y puntos de los estudiantes en ese
reto, y se quita de los cursos.

Los retos sin autor (los de ejemplo, o los de una cuenta que se eliminó) solo los puede
editar o eliminar un admin.

Guardar / quitar de guardados
POST /challenges/:id/save

Cursos:

Listar cursos (pestañas de la app: recomendaciones, tus cursos, tus likes, guardados)
GET /courses?vista=recomendaciones|mis|likes|guardados&q=texto

Ver un curso (con sus retos y comentarios; si es privado, solo para sus miembros)
GET /courses/:id

Crear curso (admin y docente)
POST /courses
Body: { "nombre", "descripcion", "publico": true, "retos": [1, 2] }
Si el curso es privado la respuesta trae codigoAcceso, que los estudiantes usan para unirse.

Eliminar curso (creador o admin): DELETE /courses/:id
Unirse: POST /courses/:id/join  Body: { "codigo" } (solo cursos privados)
Salir: DELETE /courses/:id/join
Like (da o quita): POST /courses/:id/like
Guardar (da o quita): POST /courses/:id/save
Comentar: POST /courses/:id/comments  Body: { "contenido" }
Eliminar comentario (autor, creador del curso o admin): DELETE /courses/:id/comments/:comentarioId
Agregar reto al curso (creador o admin): POST /courses/:id/challenges  Body: { "challengeId" }
Quitar reto del curso (creador o admin): DELETE /courses/:id/challenges/:retoId

Ranking, medallas y logros:

GET /ranking            -> puesto del usuario y tabla (solo estudiantes)
GET /ranking/medallas   -> una medalla por reto resuelto: bronce, plata u oro
GET /ranking/logros     -> los 8 logros, marcando los desbloqueados
GET /ranking/resumen    -> puntos, posición, medallas y logros para el perfil

Un reto resuelto suma dificultad x 100 puntos (solo la primera vez).

Notificaciones:

GET /notifications        -> las 30 más recientes y cuántas faltan por leer
POST /notifications/read  -> marca todas como leídas

Se generan cuando alguien se une, da like o comenta en tu curso, cuando agregan un
reto a un curso tuyo, cuando resuelves un reto y cuando desbloqueas un logro.

Compilador (Wandbox):

El código se compila y ejecuta en Wandbox (https://wandbox.org), un compilador en línea
gratuito que no necesita cuenta ni API key. Los lenguajes están en la tabla lenguaje; para
cada uno se usa la versión estable más reciente que ofrezca Wandbox.

Lenguajes disponibles
GET /compiler/languages

Compilar y ejecutar
POST /compiler/run

Body:
{
  "lenguaje": "python",
  "codigo": "print(input())",
  "entrada": "hola",
  "challengeId": 2
}

entrada y challengeId son opcionales. Con challengeId la compilación se suma a la
tabla stadistic del usuario (compilaciones, líneas de código, tiempo y último código).

La respuesta llega cuando el programa termina (normalmente entre 2 y 10 segundos):
{
  "exito": true,
  "estado": "Ejecución exitosa",
  "tiempo": 3.2,
  "codigoSalida": 0,
  "senal": null,
  "salida": "hola\n",
  "salidaError": "",
  "compilacion": "",
  "compilador": "CPython 3.14.0",
  "compilaciones": 1
}

estado: Ejecución exitosa, Error de compilación, Error en tiempo de ejecución o
Límite de tiempo (o memoria) excedido. Wandbox detiene los programas a los ~40 segundos.
tiempo: segundos que tardó la compilación y ejecución completas (Wandbox no informa
el tiempo de CPU ni la memoria).

Límites: una ejecución a la vez por usuario y máximo 4 simultáneas en el servidor,
porque Wandbox limita las peticiones por IP. Si se superan, la API responde 429.
Si Wandbox tiene una falla temporal se reintenta una vez; si sigue, responde 503.

Enviar solución (califica con los casos de prueba del reto)
POST /compiler/submit

Body: { "challengeId": 2, "codigo": "..." }

Ejecuta el código con cada caso y se detiene en el primero que falla. Respuesta:
{
  "aprobado": true,
  "total": 2,
  "casos": [{ "numero": 1, "aprobado": true, "estado": "Correcto" }, ...],
  "detalle": null,
  "puntosGanados": 200,
  "nuevosLogros": [{ "nombre": "Primer reto", "icono": "flag" }]
}

Si falla, detalle trae la entrada, la salida esperada, la obtenida y los errores.

Roles:

estudiante -> acceso limitado (rol por defecto al registrarse); compite en el ranking
docente -> además crea cursos y retos, edita y elimina los retos que creó, y ve las
            soluciones (no compite en el ranking)
admin -> acceso completo

Seguridad implementada:

- Autenticación con JWT
- Encriptación de contraseñas (bcrypt)
- Middleware de verificación de token
- Control de acceso por roles

Estructura del proyecto:

config/
controllers/
database/
routes/
middleware/
public/       (web y app móvil)
services/     (Wandbox, catálogos, logros y notificaciones)
server.js

Estado del proyecto:

- CRUD funcional
- Autenticación
- Roles
- Seguridad básica
- Retos de programación calificados con casos de prueba; cada autor edita y elimina los suyos
- Compilación y ejecución de código con Wandbox (gratuito)
- Cursos con likes, comentarios, guardados y cursos privados con código
- Ranking, medallas, logros y notificaciones
- Web y app móvil (PWA) con el tema de la app móvil original

Autor:
Thian