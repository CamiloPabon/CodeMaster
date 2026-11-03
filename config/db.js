import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

// Pool de conexiones: si una conexión se cae (algo normal en servidores en la nube por
// inactividad o cortes de red) el pool abre otra sola, en vez de dejar la app sin base de datos.
// Se usa igual que una conexión: db.query(...) y db.promise().query(...).
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root1234",
  database: process.env.DB_NAME || "codemaster",
  charset: "utf8mb4",
  connectionLimit: 10,
  waitForConnections: true,
  enableKeepAlive: true,
  // Algunas bases de datos en la nube (Aiven, TiDB, Azure...) exigen conexión cifrada: DB_SSL=true
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

// Comprueba al iniciar que la base de datos responde
db.query("SELECT 1", (err) => {
  if (err) {
    console.log("Error de conexión:", err);
  } else {
    console.log("Conectado a MySQL correctamente");
  }
});

export default db;
