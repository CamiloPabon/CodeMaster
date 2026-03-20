# codemaster-backend
backend del proyecto de grado
Descripción:
API REST desarrollada con Node.js y MySQL que permite gestionar usuarios con autenticación mediante JWT, incluyendo control de roles (admin y usuario).

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

4. Ejecutar servidor
node server.js

Base de datos:

Crear base de datos:
CREATE DATABASE codemaster;
USE codemaster;

Tabla de autenticación:
CREATE TABLE auth_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  correo VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  rol VARCHAR(20) DEFAULT 'user'
);

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
- User solo ve su información

Crear usuario
POST /usuarios

Actualizar usuario
PUT /usuarios/:id

Eliminar usuario
DELETE /usuarios/:id

Solo admin

Roles:

user -> acceso limitado
admin -> acceso completo

Seguridad implementada:

- Autenticación con JWT
- Encriptación de contraseñas (bcrypt)
- Middleware de verificación de token
- Control de acceso por roles

Estructura del proyecto:

config/
controllers/
routes/
middleware/
server.js

Estado del proyecto:

- CRUD funcional
- Autenticación
- Roles
- Seguridad básica

Autor:
Thian