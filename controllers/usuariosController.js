import db from "../config/db.js";
import validator from "validator";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const ROLES = ["admin", "docente", "estudiante"];

// GET
const obtenerUsuarios = (req, res) => {
  const user = req.user;

  if (user.rol === "admin") {
    // Admin ve todos
    db.query(
      `SELECT u.id, u.name AS nombre, u.email AS correo, r.tipo_rol AS rol,
         (SELECT COUNT(*) FROM classrom c WHERE c.users_id = u.id) AS cursos,
         (SELECT COUNT(*) FROM challenge ch WHERE ch.users_id = u.id) AS retos
       FROM users u JOIN rol r ON r.idROLES = u.rol_idROLES`,
      (err, results) => {
        if (err) return res.status(500).send(err);
        return res.json(results);
      }
    );
  } else {
    // Usuario normal solo se ve a sí mismo
    db.query(
      "SELECT id, name AS nombre, email AS correo FROM users WHERE id = ?",
      [user.id],
      (err, results) => {
        if (err) return res.status(500).send(err);
        return res.json(results[0]);
      }
    );
  }
};

// POST (el admin puede crear docentes; el registro público siempre crea estudiantes)
const crearUsuario = async (req, res) => {
  const { password, rol = "estudiante" } = req.body;
  const nombre = String(req.body.nombre ?? "").trim();
  const correo = String(req.body.correo ?? "").trim().toLowerCase();

  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (!validator.isEmail(correo)) {
    return res.status(400).json({ error: "Correo inválido" });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

  db.query(
    "INSERT INTO users (name, email, password, rol_idROLES) VALUES (?, ?, ?, (SELECT idROLES FROM rol WHERE tipo_rol = ?))",
    [nombre, correo, hashedPassword, rol],
    (err, result) => {
      if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "No se pudo crear el usuario" });
      }
      res.status(201).json({ mensaje: "Usuario creado correctamente", id: result.insertId, nombre, correo, rol });
    }
  );
};

// PUT (rol y password son opcionales; si no se envían, se conservan los actuales)
const actualizarUsuario = async (req, res) => {
  const id = Number(req.params.id);
  const { rol, password } = req.body;
  const nombre = String(req.body.nombre ?? "").trim();
  const correo = String(req.body.correo ?? "").trim().toLowerCase();

  if (!nombre || !correo) {
    return res.status(400).json({ error: "El nombre y el correo son obligatorios" });
  }

  if (!validator.isEmail(correo)) {
    return res.status(400).json({ error: "Correo inválido" });
  }

  if (rol && !ROLES.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  if (password && String(password).length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  // El admin no puede quitarse su propio rol (se quedaría sin acceso a la administración)
  if (id === req.user.id && rol && rol !== "admin") {
    return res.status(400).json({ error: "No puedes cambiar tu propio rol" });
  }

  const hashedPassword = password ? await bcrypt.hash(String(password), 10) : null;

  db.query(
    `UPDATE users SET name = ?, email = ?,
       rol_idROLES = COALESCE((SELECT idROLES FROM rol WHERE tipo_rol = ?), rol_idROLES),
       password = COALESCE(?, password)
     WHERE id = ?`,
    [nombre, correo, rol ?? null, hashedPassword, id],
    (err, result) => {
      if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ya existe otra cuenta con ese correo" });
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "No se pudo actualizar el usuario" });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({ mensaje: "Usuario actualizado correctamente" });
    }
  );
};

// DELETE (se borran en cascada sus cursos, comentarios, likes, estadísticas y notificaciones;
// los retos que creó se conservan sin autor)
const eliminarUsuario = (req, res) => {
  const id = Number(req.params.id);

  if (id === req.user.id) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
  }

  db.query(
    "DELETE FROM users WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "No se pudo eliminar el usuario" });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({ mensaje: "Usuario eliminado correctamente" });
    }
  );
};

export default { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };
