import crypto from "node:crypto";
import db from "../config/db.js";
import logros from "../services/logros.js";
import notificaciones from "../services/notificaciones.js";

const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0 ni I/1 para que no se confundan

// Datos de un curso con sus contadores y el estado del usuario actual (3 parámetros: id del usuario)
const CAMPOS_CURSO = `
  c.idCLASSROMS AS id, c.name AS nombre, c.description AS descripcion, c.is_public AS publico,
  c.created_at AS fecha, c.users_id AS creadorId, u.name AS creador,
  (SELECT COUNT(*) FROM classrom_like l WHERE l.classrom_idCLASSROMS = c.idCLASSROMS) AS likes,
  (SELECT COUNT(*) FROM classrom_comment m WHERE m.classrom_idCLASSROMS = c.idCLASSROMS) AS comentarios,
  (SELECT COUNT(*) FROM classrom_has_users h WHERE h.classrom_idCLASSROMS = c.idCLASSROMS) AS miembros,
  (SELECT COUNT(*) FROM classrom_has_challenge r WHERE r.classrom_idCLASSROMS = c.idCLASSROMS) AS retos,
  EXISTS (SELECT 1 FROM classrom_like l WHERE l.classrom_idCLASSROMS = c.idCLASSROMS AND l.users_id = ?) AS meGusta,
  EXISTS (SELECT 1 FROM classrom_has_users h WHERE h.classrom_idCLASSROMS = c.idCLASSROMS AND h.users_id = ?) AS unido,
  EXISTS (SELECT 1 FROM classrom_saved s WHERE s.classrom_idCLASSROMS = c.idCLASSROMS AND s.users_id = ?) AS guardado`;

// Pestañas del inicio de la app: qué cursos muestra cada una (las que filtran usan el id del usuario)
const VISTAS = {
  recomendaciones: "1 = 1",
  mis: "EXISTS (SELECT 1 FROM classrom_has_users h WHERE h.classrom_idCLASSROMS = c.idCLASSROMS AND h.users_id = ?)",
  likes: "EXISTS (SELECT 1 FROM classrom_like l WHERE l.classrom_idCLASSROMS = c.idCLASSROMS AND l.users_id = ?)",
  guardados: "EXISTS (SELECT 1 FROM classrom_saved s WHERE s.classrom_idCLASSROMS = c.idCLASSROMS AND s.users_id = ?)",
};

const formatear = (curso) => ({
  ...curso,
  publico: !!curso.publico,
  meGusta: !!curso.meGusta,
  unido: !!curso.unido,
  guardado: !!curso.guardado,
});

const patronBusqueda = (texto) => `%${texto.replace(/[\\%_]/g, "\\$&")}%`;

const nombreDe = async (usuarioId) => {
  const [[usuario]] = await db.promise().query("SELECT name FROM users WHERE id = ?", [usuarioId]);
  return usuario?.name ?? "Alguien";
};

// Curso con los permisos del usuario actual, o null si no existe
const cargarCurso = async (id, usuario) => {
  const [[curso]] = await db
    .promise()
    .query(`SELECT ${CAMPOS_CURSO}, c.access_code AS codigoAcceso FROM classrom c JOIN users u ON u.id = c.users_id WHERE c.idCLASSROMS = ?`, [
      usuario.id,
      usuario.id,
      usuario.id,
      id,
    ]);
  if (!curso) return null;

  const esCreador = curso.creadorId === usuario.id;
  const gestiona = esCreador || usuario.rol === "admin";
  const { codigoAcceso, ...datos } = formatear(curso);

  return {
    ...datos,
    // El código de un curso privado solo lo ven su creador y los administradores
    codigoAcceso: gestiona ? codigoAcceso : null,
    esCreador,
    gestiona,
    puedeVer: datos.publico || datos.unido || gestiona,
  };
};

// GET /courses?vista=recomendaciones|mis|likes|guardados&q=texto
const obtenerCursos = async (req, res) => {
  const vista = VISTAS[req.query.vista] ? req.query.vista : "recomendaciones";
  const q = String(req.query.q || "").trim();
  const params = [req.user.id, req.user.id, req.user.id];
  let where = VISTAS[vista];

  if (vista !== "recomendaciones") params.push(req.user.id);
  if (q) {
    where += " AND (c.name LIKE ? OR c.description LIKE ?)";
    params.push(patronBusqueda(q), patronBusqueda(q));
  }

  const [cursos] = await db
    .promise()
    .query(
      `SELECT ${CAMPOS_CURSO} FROM classrom c JOIN users u ON u.id = c.users_id WHERE ${where} ORDER BY c.created_at DESC, c.idCLASSROMS DESC LIMIT 100`,
      params
    );
  res.json(cursos.map(formatear));
};

// GET /courses/:id (los retos y comentarios de un curso privado solo los ven sus miembros)
const obtenerCurso = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });

  if (!curso.puedeVer) {
    return res.json({ ...curso, listaRetos: [], listaComentarios: [] });
  }

  const [retos] = await db.promise().query(
    `SELECT ch.id, ch.name AS nombre, ch.description AS descripcion, ch.difficulty AS dificultad,
            d.nombre AS dificultadNombre, ch.lenguage AS lenguaje, l.nombre AS lenguajeNombre,
            COALESCE(s.RESUELTO, 0) AS resuelto
     FROM classrom_has_challenge r
     JOIN challenge ch ON ch.id = r.challenge_id
     JOIN dificultad d ON d.nivel = ch.difficulty
     JOIN lenguaje l ON l.clave = ch.lenguage
     LEFT JOIN stadistic s ON s.challenge_id = ch.id AND s.users_id = ?
     WHERE r.classrom_idCLASSROMS = ?
     ORDER BY ch.difficulty, ch.id`,
    [req.user.id, curso.id]
  );

  const [comentarios] = await db.promise().query(
    `SELECT m.id, m.content AS contenido, m.created_at AS fecha, m.users_id AS autorId, u.name AS autor
     FROM classrom_comment m JOIN users u ON u.id = m.users_id
     WHERE m.classrom_idCLASSROMS = ?
     ORDER BY m.created_at DESC, m.id DESC LIMIT 50`,
    [curso.id]
  );

  res.json({
    ...curso,
    listaRetos: retos.map((reto) => ({ ...reto, resuelto: !!reto.resuelto })),
    listaComentarios: comentarios,
  });
};

// POST /courses (admin y docente)  body: { nombre, descripcion?, publico?, retos?: [ids] }
const crearCurso = async (req, res) => {
  const { nombre, descripcion = "", publico = true, retos = [] } = req.body;

  if (typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ error: "El nombre del curso es obligatorio" });
  }

  if (nombre.length > 255 || typeof descripcion !== "string" || descripcion.length > 500) {
    return res.status(400).json({ error: "El nombre admite 255 caracteres y la descripción 500" });
  }

  if (!Array.isArray(retos)) {
    return res.status(400).json({ error: "retos debe ser una lista de ids" });
  }

  const codigoAcceso = publico
    ? null
    : Array.from({ length: 6 }, () => ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)]).join("");

  const [resultado] = await db
    .promise()
    .query("INSERT INTO classrom (name, description, is_public, access_code, users_id) VALUES (?, ?, ?, ?, ?)", [
      nombre.trim(),
      descripcion.trim() || null,
      publico ? 1 : 0,
      codigoAcceso,
      req.user.id,
    ]);
  const id = resultado.insertId;

  // El creador queda como miembro del curso con su rol
  await db
    .promise()
    .query(
      "INSERT INTO classrom_has_users (classrom_idCLASSROMS, users_id, users_rol_idROLES) SELECT ?, id, rol_idROLES FROM users WHERE id = ?",
      [id, req.user.id]
    );

  const idsRetos = [...new Set(retos.map(Number).filter(Number.isInteger))];
  if (idsRetos.length) {
    await db
      .promise()
      .query("INSERT IGNORE INTO classrom_has_challenge (classrom_idCLASSROMS, challenge_id) SELECT ?, id FROM challenge WHERE id IN (?)", [
        id,
        idsRetos,
      ]);
  }

  const nuevosLogros = await logros.revisar(req.user.id);
  res.status(201).json({ mensaje: "Curso creado correctamente", id, codigoAcceso, nuevosLogros });
};

// DELETE /courses/:id (creador o admin)
const eliminarCurso = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });
  if (!curso.gestiona) return res.status(403).json({ error: "Solo el creador del curso puede eliminarlo" });

  await db.promise().query("DELETE FROM classrom WHERE idCLASSROMS = ?", [curso.id]);
  res.json({ mensaje: "Curso eliminado correctamente" });
};

// POST /courses/:id/join  body: { codigo } (solo para cursos privados)
const unirse = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });
  if (curso.unido) return res.json({ unido: true, miembros: curso.miembros, nuevosLogros: [] });

  if (!curso.publico && !curso.gestiona) {
    const [[{ access_code: codigo }]] = await db.promise().query("SELECT access_code FROM classrom WHERE idCLASSROMS = ?", [curso.id]);
    if (String(req.body.codigo || "").trim().toUpperCase() !== codigo) {
      return res.status(403).json({ error: "Código de acceso incorrecto" });
    }
  }

  await db
    .promise()
    .query(
      "INSERT IGNORE INTO classrom_has_users (classrom_idCLASSROMS, users_id, users_rol_idROLES) SELECT ?, id, rol_idROLES FROM users WHERE id = ?",
      [curso.id, req.user.id]
    );

  if (!curso.esCreador) {
    notificaciones.notificar(curso.creadorId, "union", `${await nombreDe(req.user.id)} se unió a tu curso "${curso.nombre}"`, `/curso/${curso.id}`);
  }

  const nuevosLogros = await logros.revisar(req.user.id);
  res.json({ unido: true, miembros: curso.miembros + 1, nuevosLogros });
};

// DELETE /courses/:id/join
const salir = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });
  if (curso.esCreador) return res.status(400).json({ error: "El creador no puede salir de su propio curso" });

  const [resultado] = await db
    .promise()
    .query("DELETE FROM classrom_has_users WHERE classrom_idCLASSROMS = ? AND users_id = ?", [curso.id, req.user.id]);
  res.json({ unido: false, miembros: curso.miembros - resultado.affectedRows });
};

// POST /courses/:id/like (da o quita el like)
const alternarLike = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });

  const [borrado] = await db
    .promise()
    .query("DELETE FROM classrom_like WHERE users_id = ? AND classrom_idCLASSROMS = ?", [req.user.id, curso.id]);
  const meGusta = borrado.affectedRows === 0;

  if (meGusta) {
    await db.promise().query("INSERT IGNORE INTO classrom_like (users_id, classrom_idCLASSROMS) VALUES (?, ?)", [req.user.id, curso.id]);
    if (!curso.esCreador) {
      notificaciones.notificar(curso.creadorId, "like", `A ${await nombreDe(req.user.id)} le gusta tu curso "${curso.nombre}"`, `/curso/${curso.id}`);
    }
  }

  res.json({ meGusta, likes: curso.likes + (meGusta ? 1 : -1) });
};

// POST /courses/:id/save (guarda o quita de guardados)
const alternarGuardado = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });

  const [borrado] = await db
    .promise()
    .query("DELETE FROM classrom_saved WHERE users_id = ? AND classrom_idCLASSROMS = ?", [req.user.id, curso.id]);
  const guardado = borrado.affectedRows === 0;
  if (guardado) {
    await db.promise().query("INSERT IGNORE INTO classrom_saved (users_id, classrom_idCLASSROMS) VALUES (?, ?)", [req.user.id, curso.id]);
  }

  res.json({ guardado });
};

// POST /courses/:id/comments  body: { contenido }
const comentar = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });
  if (!curso.puedeVer) return res.status(403).json({ error: "Únete al curso para comentar" });

  const contenido = String(req.body.contenido || "").trim();
  if (!contenido || contenido.length > 500) {
    return res.status(400).json({ error: "El comentario debe tener entre 1 y 500 caracteres" });
  }

  const [resultado] = await db
    .promise()
    .query("INSERT INTO classrom_comment (classrom_idCLASSROMS, users_id, content) VALUES (?, ?, ?)", [curso.id, req.user.id, contenido]);
  const autor = await nombreDe(req.user.id);

  if (!curso.esCreador) {
    notificaciones.notificar(curso.creadorId, "comentario", `${autor} comentó en tu curso "${curso.nombre}"`, `/curso/${curso.id}`);
  }

  const nuevosLogros = await logros.revisar(req.user.id);
  res.status(201).json({
    comentario: { id: resultado.insertId, contenido, fecha: new Date(), autorId: req.user.id, autor },
    nuevosLogros,
  });
};

// DELETE /courses/:id/comments/:comentarioId (autor, creador del curso o admin)
const eliminarComentario = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });

  const [[comentario]] = await db
    .promise()
    .query("SELECT users_id FROM classrom_comment WHERE id = ? AND classrom_idCLASSROMS = ?", [req.params.comentarioId, curso.id]);
  if (!comentario) return res.status(404).json({ error: "Comentario no encontrado" });
  if (comentario.users_id !== req.user.id && !curso.gestiona) {
    return res.status(403).json({ error: "No puedes eliminar este comentario" });
  }

  await db.promise().query("DELETE FROM classrom_comment WHERE id = ?", [req.params.comentarioId]);
  res.json({ mensaje: "Comentario eliminado" });
};

// POST /courses/:id/challenges  body: { challengeId } (creador o admin)
const agregarReto = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });
  if (!curso.gestiona) return res.status(403).json({ error: "Solo el creador del curso puede agregar retos" });

  const [[reto]] = await db.promise().query("SELECT id, name FROM challenge WHERE id = ?", [req.body.challengeId]);
  if (!reto) return res.status(404).json({ error: "Reto no encontrado" });

  const [resultado] = await db
    .promise()
    .query("INSERT IGNORE INTO classrom_has_challenge (classrom_idCLASSROMS, challenge_id) VALUES (?, ?)", [curso.id, reto.id]);

  // Avisa a los miembros del curso (menos a quien lo agregó)
  if (resultado.affectedRows) {
    await db.promise().query(
      `INSERT INTO notification (users_id, type, message, link)
       SELECT users_id, 'reto', ?, ? FROM classrom_has_users WHERE classrom_idCLASSROMS = ? AND users_id <> ?`,
      [`Nuevo reto en "${curso.nombre}": ${reto.name}`.slice(0, 255), `/reto/${reto.id}`, curso.id, req.user.id]
    );
  }

  res.status(201).json({ mensaje: "Reto agregado al curso" });
};

// DELETE /courses/:id/challenges/:retoId (creador o admin)
const quitarReto = async (req, res) => {
  const curso = await cargarCurso(req.params.id, req.user);
  if (!curso) return res.status(404).json({ error: "Curso no encontrado" });
  if (!curso.gestiona) return res.status(403).json({ error: "Solo el creador del curso puede quitar retos" });

  await db
    .promise()
    .query("DELETE FROM classrom_has_challenge WHERE classrom_idCLASSROMS = ? AND challenge_id = ?", [curso.id, req.params.retoId]);
  res.json({ mensaje: "Reto quitado del curso" });
};

export default {
  obtenerCursos,
  obtenerCurso,
  crearCurso,
  eliminarCurso,
  unirse,
  salir,
  alternarLike,
  alternarGuardado,
  comentar,
  eliminarComentario,
  agregarReto,
  quitarReto,
};
