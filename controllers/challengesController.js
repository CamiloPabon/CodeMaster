import db from "../config/db.js";
import catalogos from "../services/catalogos.js";

const PUEDEN_VER_SOLUCION = ["admin", "docente"];
const MAX_CASOS = 5;

const patronBusqueda = (texto) => `%${texto.replace(/[\\%_]/g, "\\$&")}%`;

// Un reto solo lo edita o elimina quien lo creó. Los retos sin autor (los de ejemplo), un admin.
// Parámetros: id del usuario y su rol.
const PUEDE_EDITAR = "(c.users_id = ? OR (c.users_id IS NULL AND ? = 'admin'))";

// Datos de un reto con los nombres de los catálogos y el progreso del usuario.
// Parámetros, en orden: id del usuario (guardado), id y rol (PUEDE_EDITAR), id (estadística).
const CAMPOS = `
  c.id, c.name AS nombre, c.description AS descripcion,
  c.difficulty AS dificultad, d.nombre AS dificultadNombre, d.puntos, d.medalla,
  c.lenguage AS lenguaje, l.nombre AS lenguajeNombre,
  c.users_id AS creadorId, u.name AS creador,
  COALESCE(s.COMPILACIONES, 0) AS compilaciones, COALESCE(s.RESUELTO, 0) AS resuelto,
  EXISTS (SELECT 1 FROM challenge_saved g WHERE g.challenge_id = c.id AND g.users_id = ?) AS guardado,
  ${PUEDE_EDITAR} AS puedeEditar`;
const UNIONES = `
  FROM challenge c
  JOIN dificultad d ON d.nivel = c.difficulty
  JOIN lenguaje l ON l.clave = c.lenguage
  LEFT JOIN users u ON u.id = c.users_id
  LEFT JOIN stadistic s ON s.challenge_id = c.id AND s.users_id = ?`;

const formatear = (reto) => ({
  ...reto,
  resuelto: !!reto.resuelto,
  guardado: !!reto.guardado,
  puedeEditar: !!reto.puedeEditar,
});

// Reto con el permiso de edición del usuario, o null si no existe
const retoEditable = async (id, usuario) => {
  const [[reto]] = await db
    .promise()
    .query(`SELECT c.id, c.lenguage, ${PUEDE_EDITAR} AS puedeEditar FROM challenge c WHERE c.id = ?`, [usuario.id, usuario.rol, id]);
  return reto ? { ...reto, puedeEditar: !!reto.puedeEditar } : null;
};

// Revisa los datos de un reto al crearlo o editarlo. Devuelve el error o null.
const validarReto = async ({ nombre, descripcion, dificultad, lenguaje, codigoInicial = "", solucion, casos }) => {
  const textos = [nombre, descripcion, solucion];
  if (textos.some((t) => typeof t !== "string" || !t.trim()) || !dificultad || !lenguaje) {
    return "Todos los campos son obligatorios";
  }
  if (codigoInicial !== null && typeof codigoInicial !== "string") return "El código inicial debe ser texto";
  if (nombre.length > 255) return "El nombre admite máximo 255 caracteres";
  if (descripcion.length > 255) return "La descripción admite máximo 255 caracteres";

  const [[nivel]] = await db.promise().query("SELECT nivel FROM dificultad WHERE nivel = ?", [dificultad]);
  if (!nivel) return "La dificultad no es válida";
  if (!(await catalogos.lenguaje(lenguaje))) return "Lenguaje no soportado";

  if (!Array.isArray(casos) || casos.length === 0 || casos.length > MAX_CASOS) {
    return `Agrega entre 1 y ${MAX_CASOS} casos de prueba`;
  }
  if (casos.some((caso) => typeof caso?.entrada !== "string" || typeof caso?.salida !== "string" || !caso.salida.trim())) {
    return "Cada caso de prueba necesita una entrada y una salida esperada";
  }
  return null;
};

const guardarCasos = (retoId, casos) =>
  db.promise().query("INSERT INTO challenge_test (challenge_id, input, expected_output) VALUES ?", [
    casos.map((caso) => [retoId, caso.entrada, caso.salida]),
  ]);

// GET ?q=texto&filtro=guardados|resueltos|pendientes|mios
const obtenerRetos = async (req, res) => {
  const params = [req.user.id, req.user.id, req.user.rol, req.user.id];
  let where = "1 = 1";

  const q = String(req.query.q || "").trim();
  if (q) {
    where += " AND (c.name LIKE ? OR c.description LIKE ?)";
    params.push(patronBusqueda(q), patronBusqueda(q));
  }

  if (req.query.filtro === "guardados") {
    where += " AND EXISTS (SELECT 1 FROM challenge_saved g WHERE g.challenge_id = c.id AND g.users_id = ?)";
    params.push(req.user.id);
  }
  if (req.query.filtro === "resueltos") where += " AND s.RESUELTO = 1";
  if (req.query.filtro === "pendientes") where += " AND COALESCE(s.RESUELTO, 0) = 0";
  if (req.query.filtro === "mios") {
    where += " AND c.users_id = ?";
    params.push(req.user.id);
  }

  const [retos] = await db.promise().query(`SELECT ${CAMPOS} ${UNIONES} WHERE ${where} ORDER BY c.difficulty, c.id`, params);
  res.json(retos.map(formatear));
};

// GET /dificultades (catálogo para formularios y textos de la app)
const obtenerDificultades = async (req, res) => {
  res.json(await catalogos.dificultades());
};

// GET /:id (incluye el último código que compiló el usuario, para retomar el reto)
const obtenerReto = async (req, res) => {
  const [[reto]] = await db.promise().query(
    `SELECT ${CAMPOS},
            c.code_user AS codigoInicial, c.code_teacher AS solucion, s.CODIGO AS ultimoCodigo,
            (SELECT COUNT(*) FROM challenge_test t WHERE t.challenge_id = c.id) AS casos,
            (SELECT COUNT(*) FROM stadistic e WHERE e.challenge_id = c.id AND e.users_id <> ?) AS intentos
     ${UNIONES}
     WHERE c.id = ?`,
    [req.user.id, req.user.id, req.user.rol, req.user.id, req.user.id, req.params.id]
  );

  if (!reto) {
    return res.status(404).json({ error: "Reto no encontrado" });
  }

  const respuesta = formatear(reto);

  // La solución y los casos de prueba no se le muestran a los estudiantes
  if (PUEDEN_VER_SOLUCION.includes(req.user.rol) || respuesta.puedeEditar) {
    const [casos] = await db
      .promise()
      .query("SELECT input AS entrada, expected_output AS salida FROM challenge_test WHERE challenge_id = ? ORDER BY id", [reto.id]);
    respuesta.listaCasos = casos;
  } else {
    delete respuesta.solucion;
  }

  // Cuántos estudiantes perderían su progreso: solo le interesa a quien puede borrarlo
  if (!respuesta.puedeEditar) delete respuesta.intentos;

  res.json(respuesta);
};

// POST (solo admin y docente). Quien lo crea queda como autor.
const crearReto = async (req, res) => {
  const error = await validarReto(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { nombre, descripcion, dificultad, lenguaje, codigoInicial, solucion, casos } = req.body;
  const [resultado] = await db
    .promise()
    .query("INSERT INTO challenge (name, description, difficulty, lenguage, code_user, code_teacher, users_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      nombre.trim(),
      descripcion.trim(),
      Number(dificultad),
      lenguaje,
      codigoInicial || null,
      solucion,
      req.user.id,
    ]);

  try {
    await guardarCasos(resultado.insertId, casos);
  } catch (error) {
    // Sin casos de prueba el reto no se puede calificar: se deshace
    await db.promise().query("DELETE FROM challenge WHERE id = ?", [resultado.insertId]);
    throw error;
  }

  res.status(201).json({ mensaje: "Reto creado correctamente", id: resultado.insertId });
};

// PUT /:id (solo su autor). Reemplaza los datos y los casos de prueba.
const actualizarReto = async (req, res) => {
  const reto = await retoEditable(req.params.id, req.user);
  if (!reto) return res.status(404).json({ error: "Reto no encontrado" });
  if (!reto.puedeEditar) return res.status(403).json({ error: "Solo quien creó el reto puede editarlo" });

  const error = await validarReto(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { nombre, descripcion, dificultad, lenguaje, codigoInicial, solucion, casos } = req.body;

  // El último código de cada estudiante está en el lenguaje actual
  if (lenguaje !== reto.lenguage) {
    const [[{ intentos }]] = await db
      .promise()
      .query("SELECT COUNT(*) AS intentos FROM stadistic WHERE challenge_id = ? AND users_id <> ?", [reto.id, req.user.id]);
    if (intentos > 0) {
      return res.status(400).json({ error: "No puedes cambiar el lenguaje: ya hay estudiantes con intentos en este reto" });
    }
  }

  await db
    .promise()
    .query("UPDATE challenge SET name = ?, description = ?, difficulty = ?, lenguage = ?, code_user = ?, code_teacher = ? WHERE id = ?", [
      nombre.trim(),
      descripcion.trim(),
      Number(dificultad),
      lenguaje,
      codigoInicial || null,
      solucion,
      reto.id,
    ]);

  // Primero se guardan los casos nuevos y luego se borran los anteriores: si algo falla, el reto no se queda sin casos
  const [anteriores] = await db.promise().query("SELECT id FROM challenge_test WHERE challenge_id = ?", [reto.id]);
  await guardarCasos(reto.id, casos);
  if (anteriores.length) {
    await db.promise().query("DELETE FROM challenge_test WHERE id IN (?)", [anteriores.map((caso) => caso.id)]);
  }

  res.json({ mensaje: "Reto actualizado correctamente", id: reto.id });
};

// DELETE /:id (solo su autor). Se borran también sus casos, estadísticas y guardados.
const eliminarReto = async (req, res) => {
  const reto = await retoEditable(req.params.id, req.user);
  if (!reto) return res.status(404).json({ error: "Reto no encontrado" });
  if (!reto.puedeEditar) return res.status(403).json({ error: "Solo quien creó el reto puede eliminarlo" });

  await db.promise().query("DELETE FROM challenge WHERE id = ?", [reto.id]);
  res.json({ mensaje: "Reto eliminado correctamente" });
};

// POST /:id/save (guarda o quita de guardados)
const alternarGuardado = async (req, res) => {
  const [[reto]] = await db.promise().query("SELECT id FROM challenge WHERE id = ?", [req.params.id]);
  if (!reto) return res.status(404).json({ error: "Reto no encontrado" });

  const [borrado] = await db.promise().query("DELETE FROM challenge_saved WHERE users_id = ? AND challenge_id = ?", [req.user.id, reto.id]);
  const guardado = borrado.affectedRows === 0;
  if (guardado) {
    await db.promise().query("INSERT IGNORE INTO challenge_saved (users_id, challenge_id) VALUES (?, ?)", [req.user.id, reto.id]);
  }

  res.json({ guardado });
};

export default { obtenerRetos, obtenerDificultades, obtenerReto, crearReto, actualizarReto, eliminarReto, alternarGuardado };
