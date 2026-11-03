import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


// REGISTRO
const register = async (req, res) => {
  const { nombre, correo, password } = req.body;// Agregamos el campo "rol" con un valor por defecto
  const rol = "estudiante";// Por defecto, asignamos el rol "estudiante" a todos los nuevos registros
  if (!nombre || !correo || !password) {// Validamos que se hayan proporcionado todos los campos necesarios
    return res.status(400).json({ error: "Todos los campos son obligatorios" });// Si falta algún campo, respondemos con un error 400 indicando que todos los campos son obligatorios
  }

  const hashedPassword = await bcrypt.hash(password, 10);// Hasheamos la contraseña utilizando bcrypt con un salt de 10 rondas para mayor seguridad

  db.query(// Insertamos el nuevo usuario en la base de datos, incluyendo el nombre, correo, contraseña hasheada y rol
    "INSERT INTO users (name, email, password, rol_idROLES) VALUES (?, ?, ?, (SELECT idROLES FROM rol WHERE tipo_rol = ?))",// Utilizamos una consulta parametrizada para evitar inyecciones SQL
    [nombre, correo, hashedPassword, rol],// Pasamos los valores como un array para que sean correctamente escapados por el driver de MySQL
    (err, result) => {// Manejamos la respuesta de la base de datos, verificando si hubo un error o si el registro fue exitoso
      if (err) return res.status(500).json({ error: "Correo ya registrado" });// Si hay un error, respondemos con un error 500 indicando que el correo ya está registrado (esto asume que el error es por un correo duplicado, pero en una aplicación real deberíamos manejar esto de manera más específica)
      res.json({ mensaje: "Usuario registrado correctamente" });// Si el registro es exitoso, respondemos con un mensaje de éxito
    }
  );
};

// LOGIN
// LOGIN
  const login = (req, res) => {// Definimos la función de login que se encargará de autenticar a los usuarios
    console.log("ENTRÓ AL LOGIN");// Mostramos un mensaje en la consola para indicar que se ha entrado en la función de login
    console.log("BODY:", req.body);// Mostramos el contenido del cuerpo de la solicitud para depuración, lo que nos permite ver qué datos se están enviando al endpoint de login

    const { correo, password } = req.body;// Extraemos el correo y la contraseña del cuerpo de la solicitud, que son necesarios para autenticar al usuario

  db.query(// Buscamos el usuario en la base de datos por su correo electrónico
    "SELECT u.id, u.password, r.tipo_rol AS rol FROM users u JOIN rol r ON r.idROLES = u.rol_idROLES WHERE u.email = ?",// Utilizamos una consulta parametrizada para evitar inyecciones SQL
    [correo],
    async (err, results) => {
      if (err || results.length === 0) {
        return res.status(400).json({ error: "Credenciales inválidas" });
      }

      const user = results[0];// Comparamos la contraseña proporcionada con la contraseña hasheada almacenada en la base de datos utilizando bcrypt
      const isMatch = await bcrypt.compare(password, user.password);// Si las contraseñas no coinciden, respondemos con un error indicando que las credenciales son inválidas

      if (!isMatch) {// Si las contraseñas no coinciden, respondemos con un error indicando que las credenciales son inválidas
        return res.status(400).json({ error: "Credenciales inválidas" });// Si las credenciales son válidas, generamos un token JWT que incluye el ID y el rol del usuario, utilizando una clave secreta definida en las variables de entorno y estableciendo una expiración de 1 hora
      }

      const token = jwt.sign(// Generamos un token JWT que incluye el ID y el rol del usuario, utilizando una clave secreta definida en las variables de entorno y estableciendo una expiración de 1 hora
        { id: user.id, rol: user.rol },// El payload del token incluye el ID y el rol del usuario, lo que nos permitirá implementar control de acceso basado en roles en otras partes de la aplicación
        process.env.JWT_SECRET,// La clave secreta para firmar el token se obtiene de las variables de entorno, lo que es una buena práctica para mantener la seguridad de la aplicación
        { expiresIn: "1h" }// El token expirará después de 1 hora, lo que ayuda a mejorar la seguridad al limitar el tiempo durante el cual un token comprometido podría ser utilizado por un atacante
      );

      res.json({ mensaje: "Login exitoso ", token });// Respondemos con un mensaje de éxito y el token JWT generado, que el cliente puede almacenar y usar para autenticarse en futuras solicitudes a rutas protegidas
    }
  );
};

// PERFIL
const getProfile = (req, res) => {// Obtenemos el ID del usuario autenticado desde el objeto req.user, que fue establecido por el middleware de autenticación después de verificar el token JWT
  const userId = req.user.id;// Realizamos una consulta a la base de datos para obtener la información del usuario, incluyendo su ID, nombre, correo y rol, utilizando el ID obtenido del token JWT para identificar al usuario

  db.query(
    "SELECT u.id, u.name AS nombre, u.email AS correo, r.tipo_rol AS rol FROM users u JOIN rol r ON r.idROLES = u.rol_idROLES WHERE u.id = ?",// Utilizamos una consulta parametrizada para evitar inyecciones SQL, pasando el ID del usuario como parámetro
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