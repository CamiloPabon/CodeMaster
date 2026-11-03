import db from "../config/db.js";

// Puntos de todos los estudiantes, ya ordenados (los docentes y admins no compiten)
const tablaRanking = async () => {
  const [filas] = await db.promise().query(
    `SELECT u.id, u.name AS nombre,
            CAST(COALESCE(SUM(s.PUNTOS), 0) AS UNSIGNED) AS puntos,
            CAST(COALESCE(SUM(s.RESUELTO), 0) AS UNSIGNED) AS resueltos,
            CAST(COALESCE(SUM(s.COMPILACIONES), 0) AS UNSIGNED) AS compilaciones
     FROM users u
     JOIN rol r ON r.idROLES = u.rol_idROLES
     LEFT JOIN stadistic s ON s.users_id = u.id
     WHERE r.tipo_rol = 'estudiante'
     GROUP BY u.id, u.name
     ORDER BY puntos DESC, resueltos DESC, compilaciones ASC, u.name`
  );
  return filas.map((fila, i) => ({ posicion: i + 1, ...fila }));
};

// Cuántas medallas de cada tipo tiene el usuario (los tipos salen de la tabla dificultad, de la mayor a la menor)
const conteoMedallas = async (usuarioId) => {
  const [filas] = await db.promise().query(
    `SELECT d.medalla, d.nivel, d.nombre AS dificultad,
            (SELECT COUNT(*) FROM stadistic s JOIN challenge c ON c.id = s.challenge_id
              WHERE s.users_id = ? AND s.RESUELTO = 1 AND c.difficulty = d.nivel) AS cantidad
     FROM dificultad d
     ORDER BY d.nivel DESC`,
    [usuarioId]
  );
  return filas;
};

// GET /ranking
const obtenerRanking = async (req, res) => {
  const tabla = await tablaRanking();
  res.json({
    yo: tabla.find((fila) => fila.id === req.user.id) ?? null,
    total: tabla.length,
    top: tabla.slice(0, 50),
  });
};

// GET /ranking/medallas (una medalla por reto resuelto, según su dificultad)
const obtenerMedallas = async (req, res) => {
  const [lista] = await db.promise().query(
    `SELECT c.id, c.name AS reto, c.difficulty AS dificultad, d.nombre AS dificultadNombre, d.medalla,
            s.PUNTOS AS puntos, s.FECHA_RESUELTO AS fecha
     FROM stadistic s
     JOIN challenge c ON c.id = s.challenge_id
     JOIN dificultad d ON d.nivel = c.difficulty
     WHERE s.users_id = ? AND s.RESUELTO = 1
     ORDER BY s.FECHA_RESUELTO DESC`,
    [req.user.id]
  );

  res.json({ resumen: await conteoMedallas(req.user.id), lista });
};

// GET /ranking/logros (todos los logros, marcando los desbloqueados)
const obtenerLogros = async (req, res) => {
  const [logros] = await db.promise().query(
    `SELECT a.code AS codigo, a.name AS nombre, a.description AS descripcion, a.icon AS icono,
            ua.created_at AS fecha
     FROM achievement a
     LEFT JOIN users_has_achievement ua ON ua.achievement_id = a.id AND ua.users_id = ?
     ORDER BY ua.created_at IS NULL, ua.created_at, a.id`,
    [req.user.id]
  );

  const lista = logros.map((logro) => ({ ...logro, desbloqueado: logro.fecha !== null }));
  res.json({ desbloqueados: lista.filter((l) => l.desbloqueado).length, total: lista.length, lista });
};

// GET /ranking/resumen (datos para la pantalla de perfil)
const obtenerResumen = async (req, res) => {
  const tabla = await tablaRanking();
  const yo = tabla.find((fila) => fila.id === req.user.id);

  const [[datos]] = await db.promise().query(
    `SELECT
       CAST(COALESCE((SELECT SUM(PUNTOS) FROM stadistic WHERE users_id = ?), 0) AS UNSIGNED) AS puntos,
       CAST(COALESCE((SELECT SUM(COMPILACIONES) FROM stadistic WHERE users_id = ?), 0) AS UNSIGNED) AS compilaciones,
       (SELECT COUNT(*) FROM stadistic WHERE users_id = ? AND RESUELTO = 1) AS resueltos,
       (SELECT COUNT(*) FROM users_has_achievement WHERE users_id = ?) AS logros,
       (SELECT COUNT(*) FROM achievement) AS totalLogros,
       (SELECT COUNT(*) FROM classrom_has_users WHERE users_id = ?) AS cursos`,
    Array(5).fill(req.user.id)
  );

  res.json({
    ...datos,
    posicion: yo?.posicion ?? null,
    totalEstudiantes: tabla.length,
    medallas: await conteoMedallas(req.user.id),
  });
};

export default { obtenerRanking, obtenerMedallas, obtenerLogros, obtenerResumen };
