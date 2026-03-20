import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


// REGISTRO
const register = async (req, res) => {
  const { nombre, correo, password } = req.body;// Agregamos el campo "rol" con un valor por defecto
  const rol = "user";// Por defecto, asignamos el rol "user" a todos los nuevos registros
  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO auth_users (nombre, correo, password, rol) VALUES (?, ?, ?, ?)",
    [nombre, correo, hashedPassword, rol],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Correo ya registrado" });
      res.json({ mensaje: "Usuario registrado correctamente" });
    }
  );
};

// LOGIN
const login = (req, res) => {
  const { correo, password } = req.body;

  db.query(
    "SELECT * FROM auth_users WHERE correo = ?",
    [correo],
    async (err, results) => {
      if (err || results.length === 0) {
        return res.status(400).json({ error: "Credenciales inválidas" });
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ error: "Credenciales inválidas" });
      }

      const token = jwt.sign(
        { id: user.id, rol: user.rol },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ mensaje: "Login exitoso ", token });
    }
  );
};

// PERFIL
const getProfile = (req, res) => {
  const userId = req.user.id;

  db.query(
    "SELECT id, nombre, correo, rol FROM auth_users WHERE id = ?",
    [userId],
    (err, results) => {
      if (err) return res.status(500).send(err);

      if (results.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json(results[0]);
    }
  );
};

export default {// Exportamos las funciones para usarlas en las rutas
  register,
  login,
  getProfile
};