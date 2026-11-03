// seed-docente.js
// Crea (o actualiza) un usuario DOCENTE y, opcionalmente, restablece la clave del ADMIN.
// Uso:
//   node seed-docente.js            -> crea el docente
//   node seed-docente.js --admin    -> además restablece la clave del admin a ADMIN_PASS
//
// Lee la conexión desde el .env del proyecto (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).

import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

// ----- Credenciales que quedarán configuradas -----
const DOCENTE = {
  nombre: "Docente",
  correo: "docente@codemaster.com",
  password: "Docente123*",
};
const ADMIN = {
  correo: "admin@codemaster.com",
  password: "Admin123*", // solo se aplica si ejecutas con --admin
};
// ---------------------------------------------------

const resetAdmin = process.argv.includes("--admin");

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "codemaster",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // 1) Crear o actualizar el docente
    const hashDocente = await bcrypt.hash(DOCENTE.password, 10);
    await db.query(
      `INSERT INTO users (name, email, password, rol_idROLES)
       VALUES (?, ?, ?, (SELECT idROLES FROM rol WHERE tipo_rol = 'docente'))
       ON DUPLICATE KEY UPDATE
         password = VALUES(password),
         rol_idROLES = VALUES(rol_idROLES)`,
      [DOCENTE.nombre, DOCENTE.correo, hashDocente]
    );
    console.log(`✔ Docente listo: ${DOCENTE.correo} / ${DOCENTE.password}`);

    // 2) (Opcional) Restablecer la clave del admin
    if (resetAdmin) {
      const hashAdmin = await bcrypt.hash(ADMIN.password, 10);
      const [r] = await db.query(
        "UPDATE users SET password = ? WHERE email = ?",
        [hashAdmin, ADMIN.correo]
      );
      if (r.affectedRows > 0) {
        console.log(`✔ Admin restablecido: ${ADMIN.correo} / ${ADMIN.password}`);
      } else {
        console.log(`⚠ No se encontró el admin con correo ${ADMIN.correo}`);
      }
    }

    // 3) Mostrar el estado final
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, r.tipo_rol AS rol
       FROM users u JOIN rol r ON r.idROLES = u.rol_idROLES
       ORDER BY u.id`
    );
    console.table(rows);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
