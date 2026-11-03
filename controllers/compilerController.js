import db from "../config/db.js";
import catalogos from "../services/catalogos.js";
import compilador from "../services/wandbox.js";
import logros from "../services/logros.js";
import notificaciones from "../services/notificaciones.js";

const MAX_CARACTERES = 50000;
const MAX_SIMULTANEAS = 4; // Wandbox limita las peticiones por IP y todas salen desde este servidor

// Usuarios con una ejecución en curso (una a la vez por usuario)
const enCurso = new Set();

// Reserva un turno de ejecución para el usuario; devuelve un mensaje de error si no hay cupo
const ocupar = (usuarioId) => {
  if (enCurso.has(usuarioId)) return "Ya tienes una ejecución en curso; espera a que termine";
  if (enCurso.size >= MAX_SIMULTANEAS) return "El compilador está ocupado; intenta de nuevo en unos segundos";
  enCurso.add(usuarioId);
  return null;
};

const contarLineas = (codigo) => codigo.split("\n").filter((linea) => linea.trim() !== "").length;

// Para comparar salidas se ignoran los espacios al final de cada línea y las líneas vacías del final
const normalizar = (texto) =>
  texto
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((linea) => linea.trimEnd())
    .join("\n")
    .trim();

const validarCodigo = (codigo, entrada = "") => {
  if (typeof codigo !== "string" || codigo.trim() === "") return "El código está vacío";
  if (typeof entrada !== "string") return "La entrada debe ser texto";
  if (codigo.length > MAX_CARACTERES || entrada.length > MAX_CARACTERES) {
    return `El código y la entrada admiten máximo ${MAX_CARACTERES} caracteres`;
  }
  return null;
};

const responderError = (res, error) => {
  if (error instanceof compilador.CompiladorError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
};

// Suma una compilación a la estadística del usuario en el reto (una fila por usuario y reto)
const registrarCompilacion = async (userId, challengeId, codigo, tiempo) => {
  const lineas = contarLineas(codigo);

  await db.promise().query(
    `INSERT INTO stadistic (TIEMPO, CODIGO, LINEAS_CODIGO, COMPILACIONES, challenge_id, users_id)
     VALUES (?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE TIEMPO = ?, CODIGO = ?, LINEAS_CODIGO = ?, COMPILACIONES = COMPILACIONES + 1`,
    [tiempo, codigo, lineas, challengeId, userId, tiempo, codigo, lineas]
  );

  const [[fila]] = await db.promise().query(
    "SELECT COMPILACIONES FROM stadistic WHERE users_id = ? AND challenge_id = ?",
    [userId, challengeId]
  );
  return fila.COMPILACIONES;
};

// GET /compiler/languages
const obtenerLenguajes = async (req, res) => {
  const lista = await Promise.all(
    (await catalogos.lenguajes()).map(async (lang) => {
      const { version } = await compilador.elegirCompilador(lang);
      return { clave: lang.clave, nombre: lang.nombre, monaco: lang.monaco, plantilla: lang.plantilla, version };
    })
  );
  res.json(lista);
};

// POST /compiler/run  body: { lenguaje, codigo, entrada?, challengeId? }
// Responde cuando el programa termina (entre 2 y 10 s normalmente; ~40 s si no termina).
const ejecutarCodigo = async (req, res) => {
  const { lenguaje, codigo, entrada = "", challengeId } = req.body;
  const lang = await catalogos.lenguaje(lenguaje);

  if (!lang) {
    return res.status(400).json({ error: "Lenguaje no soportado" });
  }

  const invalido = validarCodigo(codigo, entrada);
  if (invalido) {
    return res.status(400).json({ error: invalido });
  }

  const ocupado = ocupar(req.user.id);
  if (ocupado) {
    return res.status(429).json({ error: ocupado });
  }

  try {
    // Si se envía desde un reto, el reto debe existir y usar el mismo lenguaje
    let reto = null;
    if (challengeId != null) {
      const [filas] = await db.promise().query("SELECT id, lenguage FROM challenge WHERE id = ?", [challengeId]);
      reto = filas[0];

      if (!reto) {
        return res.status(404).json({ error: "Reto no encontrado" });
      }

      if (reto.lenguage !== lang.clave) {
        return res.status(400).json({ error: "Este reto se resuelve en otro lenguaje" });
      }
    }

    const resultado = await compilador.ejecutar(lang, codigo, entrada);

    // Si falla la estadística no se pierde el resultado de la ejecución
    let compilaciones = null;
    let nuevosLogros = [];
    if (reto) {
      compilaciones = await registrarCompilacion(req.user.id, reto.id, codigo, resultado.tiempo).catch((error) => {
        console.error("No se pudo guardar la estadística:", error.message);
        return null;
      });
      nuevosLogros = await logros.revisar(req.user.id);
    }

    res.json({ ...resultado, compilaciones, nuevosLogros });
  } catch (error) {
    responderError(res, error);
  } finally {
    enCurso.delete(req.user.id);
  }
};

// POST /compiler/submit  body: { challengeId, codigo }
// Ejecuta el código con cada caso de prueba del reto (se detiene en el primero que falla).
// Si pasa todos, el reto queda resuelto y suma los puntos de su dificultad (solo la primera vez).
const enviarSolucion = async (req, res) => {
  const { challengeId, codigo } = req.body;

  const invalido = validarCodigo(codigo);
  if (invalido) {
    return res.status(400).json({ error: invalido });
  }

  const [[reto]] = await db
    .promise()
    .query(
      "SELECT c.id, c.name, c.lenguage, d.puntos, d.medalla FROM challenge c JOIN dificultad d ON d.nivel = c.difficulty WHERE c.id = ?",
      [challengeId]
    );
  if (!reto) {
    return res.status(404).json({ error: "Reto no encontrado" });
  }

  const [casos] = await db
    .promise()
    .query("SELECT input, expected_output FROM challenge_test WHERE challenge_id = ? ORDER BY id LIMIT 5", [reto.id]);
  if (casos.length === 0) {
    return res.status(400).json({ error: "Este reto todavía no tiene casos de prueba" });
  }

  const lang = await catalogos.lenguaje(reto.lenguage);
  const ocupado = ocupar(req.user.id);
  if (ocupado) {
    return res.status(429).json({ error: ocupado });
  }

  try {
    const resultados = [];
    let detalle = null;
    let tiempo = 0;

    for (const [i, caso] of casos.entries()) {
      const resultado = await compilador.ejecutar(lang, codigo, caso.input);
      const aprobado = resultado.exito && normalizar(resultado.salida) === normalizar(caso.expected_output);
      tiempo += resultado.tiempo;

      resultados.push({
        numero: i + 1,
        aprobado,
        estado: aprobado ? "Correcto" : resultado.exito ? "Respuesta incorrecta" : resultado.estado,
      });

      if (!aprobado) {
        detalle = {
          entrada: caso.input,
          esperado: caso.expected_output,
          obtenido: resultado.salida,
          error: resultado.compilacion || resultado.salidaError,
        };
        break;
      }
    }

    const aprobado = !detalle;
    const compilaciones = await registrarCompilacion(req.user.id, reto.id, codigo, tiempo);

    let puntosGanados = 0;
    if (aprobado) {
      const puntos = reto.puntos;
      const [marcado] = await db
        .promise()
        .query(
          "UPDATE stadistic SET RESUELTO = 1, PUNTOS = ?, FECHA_RESUELTO = NOW() WHERE users_id = ? AND challenge_id = ? AND RESUELTO = 0",
          [puntos, req.user.id, reto.id]
        );

      if (marcado.affectedRows) {
        puntosGanados = puntos;
        notificaciones.notificar(req.user.id, "resuelto", `¡Resolviste "${reto.name}"! +${puntos} puntos`, "/ranking");
      }
    }

    const nuevosLogros = await logros.revisar(req.user.id);
    res.json({
      aprobado,
      total: casos.length,
      casos: resultados,
      detalle,
      tiempo,
      puntosGanados,
      medalla: puntosGanados ? reto.medalla : null,
      compilaciones,
      nuevosLogros,
    });
  } catch (error) {
    responderError(res, error);
  } finally {
    enCurso.delete(req.user.id);
  }
};

export default { obtenerLenguajes, ejecutarCodigo, enviarSolucion };
