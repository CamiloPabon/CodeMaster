// Editor de código: resolver un reto (#/reto/:id) o practicar libremente (#/editor)
import { api, obtenerLenguajes } from "../api.js";
import { h, icono, ir, aviso, avisarLogros, dialogo, cargando, mostrarError, plural } from "../ui.js";
import { chipsReto, autorReto, eliminarReto } from "./retos.js";

const MONACO = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min";

// Código del editor libre por lenguaje (se conserva al navegar por la app)
const borradores = {};
let lenguajeLibre = null;

// Monaco (el editor de VS Code) se carga una sola vez y solo cuando se necesita.
// Si no hay internet para el CDN, se usa un textarea.
let monacoListo = null;
function cargarMonaco() {
  monacoListo ??= new Promise((resolver) => {
    const script = h("script", { src: `${MONACO}/vs/loader.js` });
    script.onerror = () => resolver(null);
    script.onload = () => {
      // Los web workers de Monaco se crean desde el CDN con un proxy data:
      window.MonacoEnvironment = {
        getWorkerUrl: () =>
          "data:text/javascript;charset=utf-8," +
          encodeURIComponent(`self.MonacoEnvironment = { baseUrl: "${MONACO}/" }; importScripts("${MONACO}/vs/base/worker/workerMain.js");`),
      };
      window.require.config({ paths: { vs: `${MONACO}/vs` } });
      window.require(["vs/editor/editor.main"], () => resolver(window.monaco), () => resolver(null));
    };
    document.head.append(script);
  });
  return monacoListo;
}

async function crearEditor(zona, alEjecutar) {
  const monaco = await cargarMonaco();
  if (monaco) {
    const instancia = monaco.editor.create(zona, {
      theme: "vs",
      automaticLayout: true,
      fontSize: 14,
      tabSize: 4,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontFamily: "'Roboto Mono', Consolas, monospace",
    });
    instancia.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, alEjecutar);
    return {
      valor: () => instancia.getValue(),
      fijar: (codigo, lenguaje) => {
        monaco.editor.setModelLanguage(instancia.getModel(), lenguaje);
        instancia.setValue(codigo);
      },
      enfocar: () => instancia.focus(),
      destruir: () => instancia.dispose(),
    };
  }

  const area = h("textarea", { class: "editor-respaldo", spellcheck: "false", "aria-label": "Código" });
  area.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      alEjecutar();
    } else if (e.key === "Tab") {
      e.preventDefault();
      area.setRangeText("    ", area.selectionStart, area.selectionEnd, "end");
    }
  });
  zona.append(area);
  return { valor: () => area.value, fijar: (codigo) => (area.value = codigo), enfocar: () => area.focus(), destruir: () => {} };
}

const linea = (texto, clase = "") => h("div", { class: clase }, texto);
const seccion = (titulo, texto, clase = "") => [linea("── " + titulo, "titulo"), linea(texto, clase)];

export const mostrarLibre = (contenedor, _parametro, _consulta, ctx) => montar(contenedor, null, ctx);
export const mostrarReto = (contenedor, id, _consulta, ctx) => montar(contenedor, id, ctx);

async function montar(contenedor, retoId, ctx) {
  ctx.ancho();
  contenedor.replaceChildren(cargando());

  let lenguajes;
  let reto = null;
  try {
    [lenguajes, reto] = await Promise.all([obtenerLenguajes(), retoId ? api(`/challenges/${retoId}`) : null]);
  } catch (error) {
    return mostrarError(contenedor, error);
  }

  let editor = null;
  let ocupado = false;
  let lenguaje = reto ? reto.lenguaje : lenguajeLibre ?? lenguajes[0].clave;
  const plantilla = (clave) => lenguajes.find((l) => l.clave === clave)?.plantilla ?? "";
  const monacoDe = (clave) => lenguajes.find((l) => l.clave === clave)?.monaco ?? "plaintext";

  const select = h(
    "select",
    { "aria-label": "Lenguaje", disabled: !!reto },
    lenguajes.map((l) => h("option", { value: l.clave, selected: l.clave === lenguaje }, l.version ? `${l.nombre} (${l.version})` : l.nombre))
  );
  const entrada = h("textarea", { rows: "3", placeholder: "Datos que leerá tu programa (opcional)", "aria-label": "Entrada estándar" });
  const estado = h("span", { class: "estado" }, "Sin ejecutar");
  const consola = h("div", { class: "consola", "aria-live": "polite" });
  const meta = h("p", { class: "meta" });
  const zona = h("div", { class: "monaco" });
  const btnEjecutar = h("button", { class: "btn btn-chico btn-contorno", title: "Ctrl + Enter" }, icono("play_arrow", "chico"), "Ejecutar");
  const btnEnviar = reto && h("button", { class: "btn btn-chico" }, icono("send", "chico"), "Enviar solución");
  const cabecera = h("div");

  const fijarEstado = (texto, clase = "") => {
    estado.textContent = texto;
    estado.className = `estado ${clase}`.trim();
  };
  const limpiarConsola = () => {
    fijarEstado("Sin ejecutar");
    consola.replaceChildren(linea(reto ? "Ejecuta para probar con tu entrada, o envía tu solución para calificarla." : "Presiona Ejecutar (o Ctrl + Enter).", "suave"));
    meta.textContent = "";
  };

  const pintarCabecera = () => {
    if (!reto) return cabecera.replaceChildren(h("h1", { class: "titulo-vista", texto: "Editor libre" }));
    cabecera.replaceChildren(
      h(
        "article",
        { class: "tarjeta" },
        h(
          "div",
          { class: "acciones", style: "margin:0;align-items:flex-start;flex-wrap:nowrap" },
          chipsReto(reto),
          h(
            "button",
            {
              class: `contador ${reto.guardado ? "activo" : ""}`,
              "aria-label": reto.guardado ? "Quitar de guardados" : "Guardar reto",
              onclick: async () => {
                try {
                  reto.guardado = (await api(`/challenges/${reto.id}/save`, { metodo: "POST" })).guardado;
                  aviso(reto.guardado ? "Reto guardado" : "Reto quitado de guardados");
                  pintarCabecera();
                } catch (error) {
                  aviso(error.message, "error");
                }
              },
            },
            icono(reto.guardado ? "bookmark" : "bookmark_border")
          )
        ),
        h("h3", { texto: reto.nombre }),
        h("p", { texto: reto.descripcion }),
        h(
          "p",
          { class: "meta", style: "margin-top:10px" },
          `${autorReto(reto)} · Compilaciones: ${reto.compilaciones} · ${plural(reto.casos, "caso", "casos")} de prueba · Tu código se guarda cada vez que lo ejecutas`
        ),
        // Solo el autor del reto puede editarlo o eliminarlo
        reto.puedeEditar &&
          h(
            "div",
            { class: "chips", style: "margin-top:12px" },
            h("button", { class: "btn btn-chico btn-contorno", onclick: () => ir(`editar-reto/${reto.id}`) }, icono("edit", "chico"), "Editar"),
            h(
              "button",
              {
                class: "btn btn-chico btn-contorno peligro",
                onclick: async () => {
                  if (await eliminarReto(reto.id)) ir("crear/mis-retos");
                },
              },
              icono("delete", "chico"),
              "Eliminar"
            )
          )
      )
    );
  };

  const bloquear = (valor) => {
    ocupado = valor;
    btnEjecutar.disabled = valor;
    if (btnEnviar) btnEnviar.disabled = valor;
  };

  // Muestra "Ejecutando... N s" mientras responde el compilador (suele tardar 2-10 s)
  const conReloj = async (texto, accion) => {
    const inicio = Date.now();
    fijarEstado(texto, "corriendo");
    const reloj = setInterval(() => fijarEstado(`${texto} ${Math.round((Date.now() - inicio) / 1000)} s`, "corriendo"), 1000);
    try {
      return await accion();
    } finally {
      clearInterval(reloj);
    }
  };

  async function ejecutar() {
    if (ocupado || !editor) return;
    const codigo = editor.valor();
    if (!codigo.trim()) return aviso("Escribe código antes de ejecutar.", "error");

    bloquear(true);
    consola.replaceChildren(linea("Compilando y ejecutando tu código en la nube...", "suave"));
    meta.textContent = "";
    try {
      const datos = { lenguaje, codigo, entrada: entrada.value };
      if (reto) datos.challengeId = reto.id;
      const r = await conReloj("Ejecutando...", () => api("/compiler/run", { metodo: "POST", datos }));

      fijarEstado(r.estado, r.exito ? "ok" : "mal");
      const partes = [];
      if (r.compilacion) partes.push(...seccion("Compilación", r.compilacion, "aviso"));
      if (r.salida) partes.push(...seccion("Salida", r.salida));
      if (r.salidaError) partes.push(...seccion("Errores", r.salidaError, "error"));
      if (r.senal) partes.push(...seccion("Señal", r.senal, "error"));
      consola.replaceChildren(...(partes.length ? partes : [linea("(El programa terminó sin producir salida)", "suave")]));
      meta.textContent = [`⏱ ${r.tiempo.toFixed(1)} s`, r.codigoSalida ? `Código de salida: ${r.codigoSalida}` : null, r.compilador].filter(Boolean).join("  ·  ");

      if (reto && r.compilaciones != null) {
        reto.compilaciones = r.compilaciones;
        reto.ultimoCodigo = codigo;
        pintarCabecera();
      }
      avisarLogros(r.nuevosLogros);
    } catch (error) {
      fijarEstado("Error", "mal");
      consola.replaceChildren(linea(error.message, "error"));
    } finally {
      bloquear(false);
      mostrarConsola();
    }
  }

  // En el celular la salida queda debajo del editor: se desplaza hasta ella
  const mostrarConsola = () => meta.scrollIntoView({ behavior: "smooth", block: "nearest" });

  async function enviar() {
    if (ocupado || !editor) return;
    const codigo = editor.valor();
    if (!codigo.trim()) return aviso("Escribe tu solución antes de enviarla.", "error");

    bloquear(true);
    consola.replaceChildren(linea(`Probando tu solución con ${plural(reto.casos, "caso", "casos")} de prueba...`, "suave"));
    meta.textContent = "";
    try {
      const r = await conReloj("Calificando...", () => api("/compiler/submit", { metodo: "POST", datos: { challengeId: reto.id, codigo } }));
      const aprobados = r.casos.filter((c) => c.aprobado).length;
      fijarEstado(r.aprobado ? "¡Reto resuelto!" : "No pasó las pruebas", r.aprobado ? "ok" : "mal");

      const partes = [];
      if (r.puntosGanados) {
        partes.push(h("div", { class: "premio" }, icono("emoji_events"), ` ¡+${r.puntosGanados} puntos y medalla de ${r.medalla}!`));
      }
      partes.push(
        h(
          "ul",
          { class: "casos" },
          r.casos.map((c) => h("li", null, icono(c.aprobado ? "check_circle" : "cancel", c.aprobado ? "ok" : "mal"), `Caso ${c.numero}: ${c.estado}`)),
          Array.from({ length: r.total - r.casos.length }, (_, i) => h("li", { class: "suave" }, icono("radio_button_unchecked"), `Caso ${r.casos.length + i + 1}: sin ejecutar`))
        )
      );
      if (r.detalle) {
        partes.push(...seccion("Entrada", r.detalle.entrada || "(vacía)"));
        partes.push(...seccion("Salida esperada", r.detalle.esperado));
        partes.push(...seccion("Tu salida", r.detalle.obtenido || "(vacía)", "error"));
        if (r.detalle.error) partes.push(...seccion("Errores", r.detalle.error, "error"));
      }
      consola.replaceChildren(...partes);
      meta.textContent = `${aprobados}/${r.total} casos correctos  ·  ⏱ ${r.tiempo.toFixed(1)} s`;

      reto.compilaciones = r.compilaciones;
      reto.ultimoCodigo = codigo;
      if (r.aprobado) reto.resuelto = true;
      pintarCabecera();
      avisarLogros(r.nuevosLogros);
    } catch (error) {
      fijarEstado("Error", "mal");
      consola.replaceChildren(linea(error.message, "error"));
    } finally {
      bloquear(false);
      mostrarConsola();
    }
  }

  const restablecer = async () => {
    const ok = await dialogo({ titulo: "¿Restablecer el código?", contenido: h("p", { texto: "Perderás los cambios que tengas en el editor." }), aceptar: "Restablecer" });
    if (ok) editor?.fijar((reto && reto.codigoInicial) || plantilla(lenguaje), monacoDe(lenguaje));
  };

  select.addEventListener("change", () => {
    borradores[lenguaje] = editor.valor();
    lenguaje = lenguajeLibre = select.value;
    editor.fijar(borradores[lenguaje] ?? plantilla(lenguaje), monacoDe(lenguaje));
    limpiarConsola();
  });
  btnEjecutar.addEventListener("click", ejecutar);
  btnEnviar?.addEventListener("click", enviar);

  pintarCabecera();
  limpiarConsola();
  contenedor.replaceChildren(
    cabecera,
    h(
      "div",
      { class: "barra-editor" },
      h(
        "div",
        { class: "grupo" },
        h("div", { class: "campo" }, select),
        h("button", { class: "btn-texto sin-linea", onclick: restablecer }, icono("restart_alt", "chico"), " Restablecer")
      ),
      h("div", { class: "grupo botones" }, btnEjecutar, btnEnviar)
    ),
    h(
      "div",
      { class: "editor-layout" },
      zona,
      h(
        "div",
        { class: "panel" },
        h("label", { class: "meta", texto: "Entrada (stdin)" }),
        h("div", { class: "campo" }, entrada),
        h("div", { class: "cabecera-salida" }, h("strong", { texto: "Salida" }), estado),
        consola,
        meta
      )
    )
  );

  editor = await crearEditor(zona, ejecutar);
  if (!ctx.activa()) return editor.destruir(); // el usuario ya salió de la pantalla

  const codigoInicial = reto ? reto.ultimoCodigo || reto.codigoInicial || plantilla(lenguaje) : borradores[lenguaje] ?? plantilla(lenguaje);
  editor.fijar(codigoInicial, monacoDe(lenguaje));
  editor.enfocar();

  ctx.alSalir(() => {
    if (!reto) {
      borradores[lenguaje] = editor.valor();
      lenguajeLibre = lenguaje;
    }
    editor.destruir();
  });
}
