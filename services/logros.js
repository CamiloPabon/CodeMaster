import db from "../config/db.js";
import notificaciones from "./notificaciones.js";

// Condición de cada logro (el nombre, la descripción y el ícono están en la tabla achievement)
const CONDICIONES = {
  primera_compilacion: (c) => c.compilaciones >= 1,
  diez_compilaciones: (c) => c.compilaciones >= 10,
  primer_reto: (c) => c.resueltos >= 1,
  tres_retos: (c) => c.resueltos >= 3,
  reto_dificil: (c) => c.dificiles >= 1,
  primer_curso: (c) => c.cursos >= 1,
  primer_comentario: (c) => c.comentarios >= 1,
  creador: (c) => c.creados >= 1,
};

// Revisa si el usuario desbloqueó logros nuevos, los guarda, le avisa y los devuelve.
// Nunca lanza error: un fallo aquí no debe cancelar la acción del usuario.
const revisar = async (usuarioId) => {
  try {
    const [[fila]] = await db.promise().query(
      `SELECT
         (SELECT COALESCE(SUM(COMPILACIONES), 0) FROM stadistic WHERE users_id = ?) AS compilaciones,
         (SELECT COUNT(*) FROM stadistic WHERE users_id = ? AND RESUELTO = 1) AS resueltos,
         (SELECT COUNT(*) FROM stadistic s JOIN challenge c ON c.id = s.challenge_id
           WHERE s.users_id = ? AND s.RESUELTO = 1 AND c.difficulty = (SELECT MAX(nivel) FROM dificultad)) AS dificiles,
         (SELECT COUNT(*) FROM classrom_has_users h JOIN classrom c ON c.idCLASSROMS = h.classrom_idCLASSROMS
           WHERE h.users_id = ? AND c.users_id <> h.users_id) AS cursos,
         (SELECT COUNT(*) FROM classrom_comment WHERE users_id = ?) AS comentarios,
         (SELECT COUNT(*) FROM classrom WHERE users_id = ?) AS creados`,
      Array(6).fill(usuarioId)
    );
    const contadores = Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [clave, Number(valor)]));

    const [pendientes] = await db.promise().query(
      `SELECT id, code, name, icon FROM achievement
       WHERE id NOT IN (SELECT achievement_id FROM users_has_achievement WHERE users_id = ?)`,
      [usuarioId]
    );

    const nuevos = pendientes.filter((logro) => CONDICIONES[logro.code]?.(contadores));
    for (const logro of nuevos) {
      await db
        .promise()
        .query("INSERT IGNORE INTO users_has_achievement (users_id, achievement_id) VALUES (?, ?)", [usuarioId, logro.id]);
      notificaciones.notificar(usuarioId, "logro", `¡Desbloqueaste el logro "${logro.name}"!`, "/ranking/logros");
    }

    return nuevos.map((logro) => ({ nombre: logro.name, icono: logro.icon }));
  } catch (error) {
    console.error("No se pudieron revisar los logros:", error.message);
    return [];
  }
};

export default { revisar };
