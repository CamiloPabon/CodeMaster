// Cliente de Judge0 CE (https://judge0.com), motor de ejecución de código de código abierto
// (GPL v3) pensado para jueces de programación. Se usa como compilador de respaldo de Wandbox:
// el usuario lo elige en el menú "Compilador" del editor.
//
// Por defecto usa la instancia pública gratuita (https://ce.judge0.com, sin API key, con límite
// de peticiones). Si algún día se instala Judge0 en un servidor propio, basta con definir:
//   JUDGE0_URL=https://mi-servidor-judge0     JUDGE0_TOKEN=clave   (el token es opcional)
//
// Devuelve los resultados con el mismo formato que services/wandbox.js, así el controlador
// y el frontend funcionan igual con cualquiera de los dos.
import wandbox from "./wandbox.js";

const { CompiladorError } = wandbox; // misma clase de error para que el controlador la reconozca

const LIMITE_STREAM = 100 * 1024; // máximo de caracteres por salida que se devuelven al frontend
const TIEMPO_MAXIMO = 60 * 1000;
const ESPERA_CONSULTA = 1000; // si Judge0 no termina dentro de la petición, se consulta cada segundo

// Lenguajes de la tabla lenguaje (clave) -> lenguaje de Judge0 CE (GET /languages)
const LENGUAJES = {
  python: { id: 113, nombre: "Python 3.14.0", version: "3.14.0" },
  java: { id: 91, nombre: "Java (JDK 17.0.6)", version: "17.0.6" },
  c: { id: 103, nombre: "C (GCC 14.1.0)", version: "14.1.0" },
  cpp: { id: 105, nombre: "C++ (GCC 14.1.0)", version: "14.1.0" },
  javascript: { id: 102, nombre: "JavaScript (Node.js 22.08.0)", version: "22.08.0" },
};

// Estados de Judge0: 1 en cola, 2 procesando, 3 aceptado, 5 tiempo, 6 compilación,
// 7-12 errores en ejecución, 13 error interno, 14 formato de ejecutable
const EN_PROCESO = new Set([1, 2]);
const FALLA_INTERNA = new Set([13, 14]);

const CAMPOS = "stdout,stderr,compile_output,message,status,time,memory,exit_code,exit_signal,token";

// Se lee en cada llamada (y no al importar) porque dotenv.config() corre después de los imports
const baseUrl = () => (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/+$/, "");

const cabeceras = () => {
  const headers = { "Content-Type": "application/json" };
  if (process.env.JUDGE0_TOKEN) headers["X-Auth-Token"] = process.env.JUDGE0_TOKEN;
  return headers;
};

const aBase64 = (texto = "") => Buffer.from(texto, "utf8").toString("base64");
const deBase64 = (texto) => (texto ? Buffer.from(texto, "base64").toString("utf8") : "");

const recortar = (texto = "") =>
  texto.length > LIMITE_STREAM ? texto.slice(0, LIMITE_STREAM) + "\n... (salida recortada)" : texto;

const elegirCompilador = async ({ clave }) => {
  const lenguaje = LENGUAJES[clave];
  if (!lenguaje) throw new CompiladorError("Este lenguaje no está disponible en Judge0; usa Wandbox", 400);
  return { nombre: lenguaje.id, version: lenguaje.version, descripcion: `${lenguaje.nombre} · Judge0` };
};

// Hace una petición a Judge0 y traduce sus errores HTTP a mensajes para el usuario
const peticion = async (ruta, opciones = {}) => {
  let response;
  try {
    response = await fetch(`${baseUrl()}${ruta}`, { ...opciones, headers: cabeceras(), signal: AbortSignal.timeout(TIEMPO_MAXIMO) });
  } catch (error) {
    if (error.name === "TimeoutError") return null;
    throw new CompiladorError("No se pudo conectar con el compilador Judge0", 502);
  }

  if (response.status === 429) {
    throw new CompiladorError("Judge0 está limitando las peticiones de este servidor; espera unos segundos", 429);
  }

  const datos = await response.json().catch(() => null);
  if (!response.ok || !datos) {
    throw new CompiladorError(`El compilador Judge0 respondió con un error (HTTP ${response.status})`, 502);
  }
  return datos;
};

// Compila y ejecuta. Con wait=true Judge0 responde cuando el programa termina;
// si aún está en cola o procesando, se consulta su resultado hasta que termine.
const ejecutar = async (lang, codigo, entrada = "") => {
  const compilador = await elegirCompilador(lang);
  const inicio = Date.now();

  let datos = await peticion(`/submissions?base64_encoded=true&wait=true&fields=${CAMPOS}`, {
    method: "POST",
    body: JSON.stringify({ language_id: compilador.nombre, source_code: aBase64(codigo), stdin: aBase64(entrada) }),
  });

  while (datos && EN_PROCESO.has(datos.status?.id)) {
    if (Date.now() - inicio > TIEMPO_MAXIMO) {
      datos = null;
      break;
    }
    await new Promise((resolver) => setTimeout(resolver, ESPERA_CONSULTA));
    datos = await peticion(`/submissions/${datos.token}?base64_encoded=true&fields=${CAMPOS}`);
  }

  if (!datos) return limiteExcedido(compilador, inicio);

  if (FALLA_INTERNA.has(datos.status?.id)) {
    throw new CompiladorError("El compilador Judge0 tuvo una falla temporal; intenta de nuevo en unos segundos", 503);
  }

  return normalizar(datos, compilador, inicio);
};

const limiteExcedido = (compilador, inicio) => ({
  exito: false,
  estado: "Límite de tiempo excedido",
  tiempo: (Date.now() - inicio) / 1000,
  codigoSalida: null,
  senal: null,
  salida: "",
  salidaError: "El programa tardó demasiado y fue detenido. ¿Tiene un ciclo infinito o espera una entrada que no le diste?",
  compilacion: "",
  compilador: compilador.descripcion,
});

// Convierte la respuesta de Judge0 al formato que usa la app (el mismo de Wandbox)
const normalizar = (datos, compilador, inicio) => {
  const id = datos.status?.id;
  const salidaError = deBase64(datos.stderr);
  const mensaje = deBase64(datos.message);

  let estado = "Error en tiempo de ejecución";
  if (id === 3) estado = "Ejecución exitosa";
  else if (id === 5) estado = "Límite de tiempo excedido";
  else if (id === 6) estado = "Error de compilación";

  return {
    exito: id === 3,
    estado,
    tiempo: (Date.now() - inicio) / 1000,
    codigoSalida: datos.exit_code ?? (id === 3 ? 0 : null),
    senal: datos.exit_signal ? `Señal ${datos.exit_signal}` : null,
    salida: recortar(deBase64(datos.stdout)),
    // El mensaje de Judge0 (ej. "Exited with error status 1") se agrega si no hay otro error
    salidaError: recortar(salidaError || (id !== 3 && id !== 6 ? mensaje : "")),
    compilacion: recortar(deBase64(datos.compile_output)),
    compilador: compilador.descripcion,
  };
};

export default { CompiladorError, elegirCompilador, ejecutar };
