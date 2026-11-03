import db from "../config/db.js";

// Lenguajes del editor (tabla lenguaje) con la configuración de su compilador en Wandbox
const lenguajes = async () => {
  const [filas] = await db.promise().query(
    `SELECT clave, nombre, monaco, plantilla, wandbox_lenguaje, wandbox_prefijo, wandbox_defecto
     FROM lenguaje ORDER BY orden, clave`
  );
  return filas.map((f) => ({
    clave: f.clave,
    nombre: f.nombre,
    monaco: f.monaco,
    plantilla: f.plantilla,
    wandbox: { lenguaje: f.wandbox_lenguaje, prefijo: f.wandbox_prefijo, porDefecto: f.wandbox_defecto },
  }));
};

const lenguaje = async (clave) => (await lenguajes()).find((l) => l.clave === clave) ?? null;

// Niveles de dificultad (tabla dificultad): nombre, puntos y medalla de cada uno
const dificultades = async () => {
  const [filas] = await db.promise().query("SELECT nivel, nombre, puntos, medalla FROM dificultad ORDER BY nivel");
  return filas;
};

export default { lenguajes, lenguaje, dificultades };
