import db from "../config/db.js";

// Crea una notificación. Si falla, no se cancela la acción que la originó.
// enlace: ruta del frontend que se abre al tocarla (ej: "/curso/3").
const notificar = (usuarioId, tipo, mensaje, enlace = null) =>
  db
    .promise()
    .query("INSERT INTO notification (users_id, type, message, link) VALUES (?, ?, ?, ?)", [
      usuarioId,
      tipo,
      mensaje.slice(0, 255),
      enlace,
    ])
    .catch((error) => console.error("No se pudo crear la notificación:", error.message));

export default { notificar };
