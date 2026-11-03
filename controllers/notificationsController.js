import db from "../config/db.js";

// GET /notifications (las 30 más recientes y cuántas faltan por leer)
const obtenerNotificaciones = async (req, res) => {
  const [lista] = await db.promise().query(
    `SELECT id, type AS tipo, message AS mensaje, link AS enlace, is_read AS leida, created_at AS fecha
     FROM notification WHERE users_id = ?
     ORDER BY created_at DESC, id DESC LIMIT 30`,
    [req.user.id]
  );
  const [[{ noLeidas }]] = await db
    .promise()
    .query("SELECT COUNT(*) AS noLeidas FROM notification WHERE users_id = ? AND is_read = 0", [req.user.id]);

  res.json({ noLeidas, lista: lista.map((n) => ({ ...n, leida: !!n.leida })) });
};

// POST /notifications/read (marca todas como leídas)
const marcarLeidas = async (req, res) => {
  await db.promise().query("UPDATE notification SET is_read = 1 WHERE users_id = ? AND is_read = 0", [req.user.id]);
  res.json({ noLeidas: 0 });
};

export default { obtenerNotificaciones, marcarLeidas };
