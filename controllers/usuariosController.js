import db from "../config/db.js";
import validator from "validator";
import jwt from "jsonwebtoken";

// GET
const obtenerUsuarios = (req, res) => {
  const user = req.user;

  if (user.rol === "admin") {
    // Admin ve todos
    db.query("SELECT id, nombre, correo FROM auth_users", (err, results) => {
      if (err) return res.status(500).send(err);
      return res.json(results);
    });
  } else {
    // Usuario normal solo se ve a sí mismo
    db.query(
      "SELECT id, nombre, correo FROM auth_users WHERE id = ?",
      [user.id],
      (err, results) => {
        if (err) return res.status(500).send(err);
        return res.json(results[0]);
      }
    );
  }
};

// POST
const crearUsuario = (req, res) => {
  const { nombre, correo } = req.body;

  if (!nombre || !correo) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (!validator.isEmail(correo)) {
    return res.status(400).json({ error: "Correo inválido" });
  }

  db.query(
    "INSERT INTO usuarios (nombre, correo) VALUES (?, ?)",
    [nombre, correo],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ mensaje: "Usuario creado correctamente" });
    }
  );
};

// PUT
const actualizarUsuario = (req, res) => {
  const { id } = req.params;
  const { nombre, correo } = req.body;

  db.query(
    "UPDATE usuarios SET nombre = ?, correo = ? WHERE id = ?",
    [nombre, correo, id],
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
    "DELETE FROM usuarios WHERE id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ mensaje: "Usuario eliminado correctamente" });
    }
  );
};

export default { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };