// Cliente de Wandbox (https://wandbox.org), compilador en línea gratuito y sin API key.
// Su FAQ permite usarlo, pero limita las peticiones por IP y no tiene SLA: todas las
// ejecuciones salen desde este servidor, por eso el controlador limita cuántas corren a la vez.

const LIMITE_STREAM = 100 * 1024; // máximo de caracteres por salida que se devuelven al frontend
const TIEMPO_MAXIMO = 60 * 1000; // Wandbox detiene los programas a los ~40 s
const VIGENCIA_LISTA = 24 * 60 * 60 * 1000; // la lista de compiladores se consulta una vez al día
const INESTABLE = /head|alpha|beta|rc\d*$|\d[ab]\d+$|dev|snapshot|preview|-ea\b/i; // versiones de prueba

class CompiladorError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Se lee en cada llamada (y no al importar) porque dotenv.config() corre después de los imports
const baseUrl = () => (process.env.WANDBOX_URL || "https://wandbox.org").replace(/\/+$/, "");

const recortar = (texto = "") =>
  texto.length > LIMITE_STREAM ? texto.slice(0, LIMITE_STREAM) + "\n... (salida recortada)" : texto;

let lista = null; // { compiladores, fecha }

const obtenerLista = async () => {
  if (lista && Date.now() - lista.fecha < VIGENCIA_LISTA) return lista.compiladores;

  const response = await fetch(`${baseUrl()}/api/list.json`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  lista = { compiladores: await response.json(), fecha: Date.now() };
  return lista.compiladores;
};

// "cpython-3.13.8" -> [3, 13, 8]   "openjdk-jdk-22+36" -> [22, 36]
const compararVersiones = (a, b) => {
  const [x, y] = [a.match(/\d+/g) || [], b.match(/\d+/g) || []].map((v) => v.map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
};

// Compilador estable más reciente del lenguaje (columnas wandbox_* de la tabla lenguaje)
const elegirCompilador = async ({ wandbox }) => {
  try {
    const candidatos = (await obtenerLista()).filter(
      (c) => c.language === wandbox.lenguaje && c.name.startsWith(wandbox.prefijo) && !INESTABLE.test(c.name)
    );

    if (candidatos.length) {
      const [ultimo] = candidatos.sort((a, b) => compararVersiones(b.name, a.name));
      return {
        nombre: ultimo.name,
        version: ultimo.version || null,
        descripcion: `${ultimo["display-name"]} ${ultimo.version}`.trim(),
      };
    }
  } catch (error) {
    console.error("No se pudo consultar la lista de compiladores de Wandbox:", error.message);
  }

  return { nombre: wandbox.porDefecto, version: null, descripcion: wandbox.porDefecto };
};

// Wandbox guarda el código Java como prog.java, así que una clase pública de nivel
// superior ("public class Main") no compila. Quitarle el "public" no cambia el programa.
const prepararCodigo = (clave, codigo) =>
  clave === "java"
    ? codigo.replace(
        /^([ \t]*)public\s+((?:(?:abstract|final|sealed|non-sealed|strictfp|static)\s+)*)(class|interface|enum|record)\b/gm,
        "$1$2$3"
      )
    : codigo;

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

// Falla de la infraestructura de Wandbox (no del programa del estudiante)
const FALLA_TEMPORAL = /OCI runtime error/;

// Compila y ejecuta. Wandbox responde cuando el programa termina, no hay que consultar después.
// Si Wandbox tiene una falla temporal se reintenta una vez, para no culpar al código del estudiante.
const ejecutar = async (lang, codigo, entrada) => {
  const compilador = await elegirCompilador(lang);
  const inicio = Date.now();

  for (let intento = 1; ; intento++) {
    const datos = await compilar(compilador, lang, codigo, entrada);
    if (datos === null) return limiteExcedido(compilador, inicio);

    if (!FALLA_TEMPORAL.test((datos.program_error || "") + (datos.compiler_error || ""))) {
      return normalizar(datos, compilador, inicio);
    }
    if (intento === 2) {
      throw new CompiladorError("El compilador en línea tuvo una falla temporal; intenta de nuevo en unos segundos", 503);
    }
    await new Promise((resolver) => setTimeout(resolver, 1500));
  }
};

// Envía el código a Wandbox. Devuelve null si el programa no terminó a tiempo.
const compilar = async (compilador, lang, codigo, entrada) => {
  let response;
  try {
    response = await fetch(`${baseUrl()}/api/compile.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: compilador.nombre,
        code: prepararCodigo(lang.clave, codigo),
        stdin: entrada,
        save: false,
      }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO),
    });
  } catch (error) {
    if (error.name === "TimeoutError") return null;
    throw new CompiladorError("No se pudo conectar con el compilador en línea (Wandbox)", 502);
  }

  // 504: Wandbox (o su proxy) cortó la petición porque el programa no terminaba
  if (response.status === 504) return null;

  if (response.status === 429) {
    throw new CompiladorError("Wandbox está limitando las peticiones de este servidor; espera unos segundos", 429);
  }

  const datos = response.ok ? await response.json().catch(() => null) : null;
  if (!datos) {
    throw new CompiladorError(`El compilador en línea respondió con un error (HTTP ${response.status})`, 502);
  }
  return datos;
};

// Convierte la respuesta de Wandbox al formato que usa la app
const normalizar = (datos, compilador, inicio) => {
  const codigoSalida = datos.status === "" || datos.status == null ? null : Number(datos.status);
  const senal = datos.signal || null;
  const noSeEjecuto = !datos.program_output && !datos.program_error;

  let estado = "Error en tiempo de ejecución";
  if (codigoSalida === 0 && !senal) estado = "Ejecución exitosa";
  else if (noSeEjecuto && /\berror\b/i.test(datos.compiler_error || "")) estado = "Error de compilación";
  else if (codigoSalida === 137) estado = "Límite de tiempo o memoria excedido"; // SIGKILL

  return {
    exito: estado === "Ejecución exitosa",
    estado,
    tiempo: (Date.now() - inicio) / 1000,
    codigoSalida,
    senal,
    salida: recortar(datos.program_output),
    salidaError: recortar(datos.program_error),
    compilacion: recortar((datos.compiler_output || "") + (datos.compiler_error || "")),
    compilador: compilador.descripcion,
  };
};

export default { CompiladorError, elegirCompilador, ejecutar };
