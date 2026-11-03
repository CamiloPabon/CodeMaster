// Cliente de la API de CodeMaster. La web y la app móvil las sirve el mismo
// servidor Node, así que las rutas son relativas (sin http://localhost:3000).
const CLAVE_TOKEN = "codemaster_token";

let token = null;
try {
  token = localStorage.getItem(CLAVE_TOKEN);
} catch {
  /* sin almacenamiento local la sesión dura hasta recargar */
}

export const sesion = { usuario: null };

export const hayToken = () => !!token;

export function guardarToken(valor) {
  token = valor;
  try {
    if (valor) localStorage.setItem(CLAVE_TOKEN, valor);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* ver arriba */
  }
}

// Pide a main.js que cierre la sesión (por ejemplo, al expirar el token)
export const cerrarSesion = () => window.dispatchEvent(new Event("cerrar-sesion"));

export async function api(ruta, { metodo = "GET", datos } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;

  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers,
      body: datos === undefined ? undefined : JSON.stringify(datos),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión.");
  }

  const cuerpo = await respuesta.json().catch(() => ({}));

  if (respuesta.status === 401 && sesion.usuario) {
    cerrarSesion();
    throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
  }

  if (!respuesta.ok) {
    const error = new Error(cuerpo.error || "Error " + respuesta.status);
    error.status = respuesta.status;
    throw error;
  }

  return cuerpo;
}

// Catálogos de la base de datos (se piden una sola vez por sesión de la página)
const cache = {};
const unaVez = (ruta) => {
  cache[ruta] ??= api(ruta).catch((error) => {
    delete cache[ruta];
    throw error;
  });
  return cache[ruta];
};

// Lenguajes del editor (tabla lenguaje + versión actual del compilador en Wandbox)
export const obtenerLenguajes = () => unaVez("/compiler/languages");

// Niveles de dificultad: nombre, puntos y medalla (tabla dificultad)
export const obtenerDificultades = () => unaVez("/challenges/dificultades");
