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
      "SELECT u.id, u.name AS nombre, u.email AS correo, r.tipo_rol AS rol FROM users u JOIN rol r ON r.idROLES = u.rol_idROLES",
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

// PUT (rol es opcional; si no se envía, se conserva el actual)
const actualizarUsuario = (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol } = req.body;

  if (rol && !ROLES.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  db.query(
    "UPDATE users SET name = ?, email = ?, rol_idROLES = COALESCE((SELECT idROLES FROM rol WHERE tipo_rol = ?), rol_idROLES) WHERE id = ?",
    [nombre, correo, rol ?? null, id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ mensaje: "Usuario actualizado correctamente" });
    }
  );
};

// DELETE
const eliminarUsuario = (req, res) => {
  const { id } = req.params;

  db.query(
    "DELETE FROM users WHERE id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ mensaje: "Usuario eliminado correctamente" });
    }
  );
};

export default { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };
