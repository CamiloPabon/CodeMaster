# CodeMaster Backend

Backend del proyecto de grado CodeMaster. Es una API REST desarrollada con Node.js,
Express y MySQL para gestionar usuarios, cursos, retos de programación y gamificación.
También sirve la aplicación web y la app móvil (PWA) desde el mismo servidor.

## Funcionalidades

- Autenticación con JWT y roles de administrador, docente y estudiante.
- Cursos públicos y privados con retos, miembros, likes, comentarios y guardados.
- Retos de programación con casos de prueba y seguimiento del progreso.
- Compilación y ejecución de código mediante Wandbox.
- Ranking, puntos, medallas, logros y notificaciones.
- Aplicación web y app móvil PWA servidas desde `public/`.

## Tecnologías

- Node.js (20.11 o superior)
- Express
- MySQL
- `mysql2`, `jsonwebtoken`, `bcryptjs` y `dotenv`

## Instalación y ejecución local

### Requisitos

- Node.js 20.11 o superior y npm.
- MySQL y una base de datos configurada para CodeMaster.

### Pasos

1. Clona el repositorio e instala las dependencias:

   ```bash
   git clone https://github.com/CamiloPabon/CodeMaster.git
   cd CodeMaster
   npm install
   ```

2. Copia `.env.example` como `.env` (en PowerShell: `Copy-Item .env.example .env`) y
   configura la conexión a MySQL y la clave JWT:

   ```dotenv
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=tu_contraseña
   DB_NAME=codemaster
   DB_SSL=false
   PORT=3000
   JWT_SECRET=una_clave_larga_y_aleatoria
   ```

   Usa `DB_SSL=true` si tu proveedor de base de datos requiere una conexión cifrada
   (por ejemplo, Aiven, TiDB o Azure). Puedes generar una clave JWT con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   El archivo `.env` contiene credenciales y no debe subirse a GitHub; está excluido
   mediante `.gitignore`.

   Wandbox no requiere una cuenta ni una API key. `WANDBOX_URL` es opcional y solo se
   configura para usar otra instancia:

   ```dotenv
   WANDBOX_URL=https://wandbox.org
   ```

3. Crea la base de datos siguiendo la sección [Base de datos](#base-de-datos).
4. Inicia el servidor:

   ```bash
   npm start
   ```

5. Abre la aplicación:

   - Web: <http://localhost:3000>
   - App móvil: <http://localhost:3000/movil/>

## App móvil en la red local

Para abrir la app desde un celular, conecta el PC y el teléfono a la misma red Wi-Fi y
visita `http://IP_DEL_PC:3000/movil/`. En Windows puedes consultar la dirección del PC
con `ipconfig`; es posible que debas permitir Node.js en el firewall.

La app puede abrirse en el navegador por la red local. Para instalarla como PWA, el
navegador requiere HTTPS o `localhost`; al desplegarla en un servicio con HTTPS estará
disponible la instalación.

## Despliegue en la nube

La aplicación está desplegada en **Render** y utiliza una base de datos MySQL en **Aiven**,
en la base `defaultdb`. Para configurar el despliegue:

1. En Render, crea un **Web Service** y conecta el repositorio de GitHub
   `CamiloPabon/CodeMaster`.
2. Selecciona la rama que quieras desplegar y configura:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
3. En la sección **Environment** del servicio, agrega las variables de conexión de Aiven:
   `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=defaultdb`,
   `DB_SSL=true` y `JWT_SECRET`.
4. Guarda los cambios y despliega el servicio. Render asigna `PORT` automáticamente;
   no hace falta configurarlo manualmente.

Las credenciales de Aiven y el valor de `JWT_SECRET` se configuran directamente en las
variables de entorno privadas de Render. No deben escribirse en el README ni subirse al
repositorio. La dirección HTTPS que proporciona Render sirve tanto la web como la app
móvil en `/movil/`.

Para copiar una base de datos local a Aiven, primero genera un respaldo y luego impórtalo
en la base `defaultdb`:

```bash
mysqldump -u root -p --single-transaction --set-gtid-purged=OFF --no-tablespaces --default-character-set=utf8mb4 codemaster > respaldo.sql
mysql -h HOST_AIVEN -P PUERTO_AIVEN -u avnadmin -p --ssl-mode=REQUIRED --default-character-set=utf8mb4 defaultdb < respaldo.sql
```

Reemplaza `HOST_AIVEN` y `PUERTO_AIVEN` por los datos de conexión de Aiven.

## Frontend

El servidor sirve los archivos estáticos de `public/`:

| Ruta | Contenido |
| --- | --- |
| `public/index.html` | Aplicación web |
| `public/movil/` | App móvil: `index.html`, `manifest.webmanifest` y `sw.js` |
| `public/app/` | Código JavaScript y estilos compartidos, con las vistas de cada pantalla |
| `public/img/` | Logo e íconos |

El frontend usa módulos JavaScript nativos y no requiere un paso de compilación.

## Base de datos

El esquema completo, con tablas, roles, logros, retos de ejemplo y casos de prueba, está
en [`database/codemaster.sql`](database/codemaster.sql). El modelo original está en
`codemaster.mwb`; las correcciones y adiciones de la app móvil se indican al inicio del
archivo SQL.

### Instalación nueva

```bash
mysql -u root -p --default-character-set=utf8mb4 < database/codemaster.sql
```

### Actualización de una base existente

Ejecuta únicamente las migraciones que correspondan, en este orden:

1. Si todavía existe la tabla `auth_users`, ejecuta
   `database/migracion_auth_users.sql`. Migra las cuentas a `users` y elimina las tablas
   `auth_users` y `usuarios`.
2. Si `classrom` todavía tiene la columna `challenge_id`, ejecuta
   `database/migracion_cursos_gamificacion.sql`. Agrega cursos, likes, comentarios,
   guardados, casos de prueba, logros y notificaciones.
3. Si no existen las tablas `dificultad` y `lenguaje`, ejecuta
   `database/migracion_catalogos_autoria.sql`. Agrega los catálogos y el autor de cada
   reto.

Los nombres, puntos y medallas de las dificultades, los lenguajes y sus plantillas, los
roles, logros, retos, cursos, estadísticas y notificaciones se obtienen de la base de
datos. Wandbox proporciona las versiones de los compiladores.

Las tablas principales incluyen `rol`, `users`, `dificultad`, `lenguaje`, `challenge`,
`challenge_test`, `challenge_saved`, `classrom` (cursos), `classrom_has_users`,
`classrom_has_challenge`, `classrom_like`, `classrom_comment`, `classrom_saved`,
`stadistic`, `ranking`, `stadistic_has_ranking`, `achievement`,
`users_has_achievement` y `notification`.

## API

Las rutas protegidas requieren el token JWT en el encabezado:

```http
Authorization: Bearer <JWT_TOKEN>
```

### Autenticación y usuarios

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/auth/register` | Registro público; crea una cuenta de estudiante |
| `POST` | `/auth/login` | Inicia sesión y devuelve un token JWT |
| `GET` | `/auth/profile` | Obtiene el perfil del usuario autenticado |
| `GET` | `/usuarios` | Admin: lista usuarios; otros roles: obtienen sus propios datos |
| `POST` | `/usuarios` | Crea un usuario; solo admin |
| `PUT` | `/usuarios/:id` | Actualiza usuario; solo admin |
| `DELETE` | `/usuarios/:id` | Elimina usuario; solo admin |

Ejemplo de registro:

```json
{
  "nombre": "Usuario",
  "correo": "user@gmail.com",
  "password": "una-clave-segura"
}
```

Ejemplo de inicio de sesión:

```json
{
  "mensaje": "Login exitoso",
  "token": "JWT_TOKEN"
}
```

Para crear un docente, un administrador envía `POST /usuarios`:

```json
{
  "nombre": "Docente",
  "correo": "docente@gmail.com",
  "password": "una-clave-segura",
  "rol": "docente"
}
```

`rol` acepta `admin`, `docente` o `estudiante`; si se omite, el nuevo usuario será
estudiante. La contraseña debe tener al menos seis caracteres.

### Retos

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/challenges?q=texto&filtro=...` | Lista retos; admite filtros `pendientes`, `resueltos`, `guardados` y `mios` |
| `GET` | `/challenges/dificultades` | Lista dificultades, puntos y medallas |
| `GET` | `/challenges/:id` | Obtiene un reto y el último código compilado por el usuario |
| `POST` | `/challenges` | Crea un reto; admin y docente |
| `PUT` | `/challenges/:id` | Actualiza un reto; su autor |
| `DELETE` | `/challenges/:id` | Elimina un reto; su autor |
| `POST` | `/challenges/:id/save` | Guarda o quita un reto de guardados |

La solución del docente y los casos de prueba solo son visibles para administradores y
docentes. Para crear un reto:

```json
{
  "nombre": "Suma de dos números",
  "descripcion": "Lee dos enteros e imprime su suma.",
  "dificultad": 1,
  "lenguaje": "c",
  "codigoInicial": "#include <stdio.h> ...",
  "solucion": "#include <stdio.h> ...",
  "casos": [
    { "entrada": "4 5", "salida": "9" }
  ]
}
```

`dificultad` identifica un nivel de la tabla `dificultad`; `lenguaje` es una clave de la
tabla `lenguaje` (por ejemplo, `python`, `java`, `c`, `cpp` o `javascript`). Se admiten
entre uno y cinco casos de prueba. Quien crea el reto queda como su autor. Si ya hay
intentos de estudiantes, no se puede cambiar el lenguaje del reto. Los retos sin autor
solo pueden ser editados o eliminados por un administrador. Al eliminar un reto también
se eliminan sus casos de prueba, estadísticas y puntos, y se quita de los cursos.

### Cursos

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/courses?vista=...&q=texto` | Lista recomendaciones, cursos propios, likes o guardados |
| `GET` | `/courses/:id` | Obtiene un curso, sus retos y comentarios; los cursos privados son solo para sus miembros |
| `POST` | `/courses` | Crea un curso; admin y docente |
| `DELETE` | `/courses/:id` | Elimina un curso; creador o admin |
| `POST` | `/courses/:id/join` | Se une a un curso privado usando su código |
| `DELETE` | `/courses/:id/join` | Sale de un curso |
| `POST` | `/courses/:id/like` | Da o quita like |
| `POST` | `/courses/:id/save` | Guarda o quita de guardados |
| `POST` | `/courses/:id/comments` | Agrega un comentario |
| `DELETE` | `/courses/:id/comments/:comentarioId` | Elimina un comentario; autor, creador del curso o admin |
| `POST` | `/courses/:id/challenges` | Agrega un reto al curso; creador o admin |
| `DELETE` | `/courses/:id/challenges/:retoId` | Quita un reto del curso; creador o admin |

Los valores admitidos para `vista` son `recomendaciones`, `mis`, `likes` y `guardados`.
Ejemplo de creación:

```json
{
  "nombre": "Curso de programación",
  "descripcion": "Introducción a la programación",
  "publico": true,
  "retos": [1, 2]
}
```

Al crear un curso privado, la respuesta incluye `codigoAcceso`. Para unirse, envía
`{ "codigo": "..." }` a `POST /courses/:id/join`. Para agregar un reto, el cuerpo es
`{ "challengeId": 1 }`; para comentar, `{ "contenido": "..." }`.

### Ranking, logros y notificaciones

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/ranking` | Posición del usuario y tabla del ranking (estudiantes) |
| `GET` | `/ranking/medallas` | Medallas obtenidas por retos resueltos |
| `GET` | `/ranking/logros` | Logros disponibles y desbloqueados |
| `GET` | `/ranking/resumen` | Puntos, posición, medallas y logros del perfil |
| `GET` | `/notifications` | Últimas 30 notificaciones y cantidad sin leer |
| `POST` | `/notifications/read` | Marca todas las notificaciones como leídas |

Resolver un reto suma `dificultad × 100` puntos, una sola vez. Las notificaciones se
generan, entre otros eventos, al unirse a un curso, recibir likes o comentarios, agregar
retos a un curso, resolver un reto o desbloquear un logro.

### Compilador

El código se compila y ejecuta en [Wandbox](https://wandbox.org). No requiere cuenta ni
API key. Los lenguajes disponibles se configuran en la tabla `lenguaje`, y se utiliza la
versión estable que ofrezca Wandbox para cada uno.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/compiler/languages` | Lista los lenguajes disponibles |
| `POST` | `/compiler/run` | Compila y ejecuta código |
| `POST` | `/compiler/submit` | Ejecuta y califica una solución con los casos del reto |

Ejemplo para compilar y ejecutar:

```json
{
  "lenguaje": "python",
  "codigo": "print(input())",
  "entrada": "hola",
  "challengeId": 2
}
```

`entrada` y `challengeId` son opcionales. Si se envía `challengeId`, la compilación se
registra en `stadistic` para el usuario (compilaciones, líneas de código, tiempo y último
código). La respuesta incluye el estado, la salida, los errores, el compilador y el
tiempo de ejecución. Los estados posibles incluyen ejecución exitosa, error de
compilación, error en tiempo de ejecución y límite de tiempo o memoria excedido.

Wandbox detiene los programas después de aproximadamente 40 segundos. El servidor permite
una ejecución simultánea por usuario y hasta cuatro en total; si se supera el límite,
responde `429`. Ante una falla temporal de Wandbox se realiza un reintento; si persiste,
la API responde `503`.

Para enviar una solución, usa `POST /compiler/submit`:

```json
{
  "challengeId": 2,
  "codigo": "..."
}
```

La respuesta indica si fue aprobada, el resultado de los casos, los puntos obtenidos y
los nuevos logros desbloqueados. Si falla, incluye el detalle del primer caso que no pasó.

## Roles

- **Estudiante:** rol predeterminado del registro público; tiene acceso de estudiante y
  participa en el ranking.
- **Docente:** puede crear cursos y retos, editar o eliminar sus propios retos y ver las
  soluciones; no participa en el ranking.
- **Admin:** administra los usuarios y tiene acceso completo.

## Estructura del proyecto

```text
config/       Configuración de la base de datos
controllers/  Lógica de las rutas
database/     Esquema y migraciones SQL
middleware/   Autenticación y permisos por rol
public/       Aplicación web y app móvil
routes/       Rutas de la API
services/     Wandbox, catálogos, logros y notificaciones
server.js     Punto de entrada del servidor
```

## Autores

- Cristhian Cruz
- Camilo Pabon
