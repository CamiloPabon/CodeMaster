import path from "node:path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import usuariosRoutes from "./routes/usuariosRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import challengesRoutes from "./routes/challengesRoutes.js";
import compilerRoutes from "./routes/compilerRoutes.js";
import coursesRoutes from "./routes/coursesRoutes.js";
import rankingRoutes from "./routes/rankingRoutes.js";
import notificationsRoutes from "./routes/notificationsRoutes.js";

dotenv.config();// Carga las variables de entorno desde el archivo .env

const app = express();// Inicializa la aplicación Express

app.use(express.json());// Middleware para parsear JSON en las solicitudes
app.use(cors());// Middleware para habilitar CORS en todas las rutas

app.use("/usuarios", usuariosRoutes);// Rutas para usuarios
app.use("/auth", authRoutes);// Rutas para autenticación
app.use("/challenges", challengesRoutes);// Rutas para los retos de programación
app.use("/compiler", compilerRoutes);// Rutas para compilar y ejecutar código con Wandbox (compilador en línea gratuito)
app.use("/courses", coursesRoutes);// Rutas para cursos: likes, comentarios, guardados y miembros
app.use("/ranking", rankingRoutes);// Rutas para ranking, medallas y logros
app.use("/notifications", notificationsRoutes);// Rutas para notificaciones

app.use(express.static(path.join(import.meta.dirname, "public")));// Sirve la web (/) y la app móvil (/movil/)

// Cualquier error no controlado se responde en JSON (ej. un body con JSON mal formado)
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "El cuerpo de la solicitud no es un JSON válido" });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "La solicitud es demasiado grande" });
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, (error) => {
  if (error) throw error;// En Express 5 los errores al iniciar (ej. puerto ocupado por otro servidor) llegan aquí
  console.log(`Servidor corriendo en puerto ${PORT}`);// Inicia el servidor en el puerto especificado en las variables de entorno
});