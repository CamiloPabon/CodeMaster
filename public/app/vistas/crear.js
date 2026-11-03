// Crear: cursos y retos (docentes y administradores), y editar los retos propios.
// Los estudiantes ven el editor libre.
import { api, sesion, obtenerLenguajes, obtenerDificultades } from "../api.js";
import { h, icono, ir, aviso, avisarLogros, dialogo, conCarga, pestanas, vacio, cargando, mostrarError } from "../ui.js";
import { tarjetaEditorLibre, tarjetaReto, eliminarReto } from "./retos.js";

const MAX_CASOS = 5;

const campo = (etiqueta, control, ayuda = null) =>
  h("div", { class: "campo" }, h("label", null, etiqueta, control), ayuda && h("p", { class: "campo-ayuda" }, ayuda));

// Control segmentado: [[valor, icono, texto], ...]
function segmentos(opciones, inicial, alCambiar) {
  let actual = inicial;
  const contenedor = h("div", { class: "segmentos", role: "radiogroup" });
  const pintar = () =>
    contenedor.replaceChildren(
      ...opciones.map(([valor, nombreIcono, texto]) =>
        h(
          "button",
          {
            type: "button",
            class: `segmento ${valor === actual ? "activo" : ""}`,
            role: "radio",
            "aria-checked": String(valor === actual),
            onclick: () => {
              actual = valor;
              pintar();
              alCambiar(valor);
            },
          },
          valor === actual ? icono("check", "chico") : nombreIcono && icono(nombreIcono, "chico"),
          texto
        )
      )
    );
  pintar();
  return contenedor;
}

export function mostrar(contenedor, pestana) {
  if (sesion.usuario.rol === "estudiante") {
    contenedor.replaceChildren(
      h("h1", { class: "titulo-vista", texto: "Crear" }),
      tarjetaEditorLibre(),
      vacio(
        "school",
        "Los cursos y los retos los crean tus docentes. Únete a un curso desde Inicio para empezar a resolver retos.",
        h("button", { class: "btn btn-chico", onclick: () => ir("inicio/recomendaciones") }, "Ver cursos")
      )
    );
    return;
  }

  const activa = ["reto", "mis-retos"].includes(pestana) ? pestana : "curso";
  const cuerpo = h("div");
  contenedor.replaceChildren(
    pestanas(
      [
        ["curso", "Nuevo curso"],
        ["reto", "Nuevo reto"],
        ["mis-retos", "Mis retos"],
      ],
      activa,
      (clave) => ir(`crear/${clave}`)
    ),
    cuerpo
  );
  if (activa === "curso") formularioCurso(cuerpo);
  else if (activa === "reto") formularioReto(cuerpo);
  else misRetos(cuerpo);
}

// Retos que creó el usuario, con su menú para editarlos o eliminarlos
async function misRetos(contenedor) {
  contenedor.replaceChildren(cargando());
  try {
    const retos = await api("/challenges?filtro=mios");
    if (!retos.length) {
      return contenedor.replaceChildren(
        vacio("code_off", "Aún no has creado retos.", h("button", { class: "btn btn-chico", onclick: () => ir("crear/reto") }, "Crear reto"))
      );
    }
    contenedor.replaceChildren(
      h("p", { class: "meta", style: "margin-bottom:8px", texto: "Solo tú puedes editar o eliminar estos retos (menú ⋯ de cada tarjeta)." }),
      h("div", { class: "rejilla" }, retos.map((reto) => tarjetaReto(reto)))
    );
  } catch (error) {
    mostrarError(contenedor, error);
  }
}

// #/editar-reto/:id (solo para su autor)
export async function mostrarEdicion(contenedor, id) {
  contenedor.replaceChildren(cargando());
  let reto;
  try {
    reto = await api(`/challenges/${id}`);
  } catch (error) {
    return mostrarError(contenedor, error);
  }
  if (!reto.puedeEditar) {
    return contenedor.replaceChildren(vacio("lock", "Solo quien creó este reto puede editarlo."));
  }

  const cuerpo = h("div");
  contenedor.replaceChildren(
    h(
      "div",
      { class: "acciones", style: "margin:0 0 12px" },
      h("h1", { class: "titulo-vista", style: "margin:0", texto: "Editar reto" }),
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
    ),
    cuerpo
  );
  formularioReto(cuerpo, reto);
}

async function formularioCurso(contenedor) {
  const nombre = h("input", { maxlength: "255", placeholder: "Ej: Programación Web Avanzada" });
  const descripcion = h("textarea", { maxlength: "500", placeholder: "¿De qué trata el curso?" });
  const ayudaVisibilidad = h("p", { class: "campo-ayuda" });
  const listaRetos = h("div", null, h("p", { class: "meta", texto: "Cargando retos..." }));
  let publico = true;

  const explicar = () =>
    (ayudaVisibilidad.textContent = publico
      ? "Cualquier estudiante puede verlo y unirse."
      : "Aparece en el feed, pero para unirse se necesita el código de acceso que se genera al crearlo.");
  explicar();

  const boton = h("button", { class: "btn btn-bloque", type: "submit" }, "Crear curso");
  const formulario = h(
    "form",
    {
      class: "tarjeta",
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        if (!nombre.value.trim()) return aviso("Escribe el nombre del curso", "error");
        conCarga(boton, async () => {
          try {
            const retos = [...listaRetos.querySelectorAll("input:checked")].map((c) => Number(c.value));
            const r = await api("/courses", { metodo: "POST", datos: { nombre: nombre.value, descripcion: descripcion.value, publico, retos } });
            avisarLogros(r.nuevosLogros);
            if (r.codigoAcceso) {
              await dialogo({
                titulo: "Curso privado creado",
                contenido: [h("p", { texto: "Comparte este código con tus estudiantes para que se unan:" }), h("div", { class: "codigo-acceso", texto: r.codigoAcceso })],
                aceptar: "Entendido",
                cancelar: null,
              });
            } else {
              aviso("Curso creado", "exito");
            }
            ir(`curso/${r.id}`);
          } catch (error) {
            aviso(error.message, "error");
          }
        });
      },
    },
    campo("Nombre del curso", nombre),
    campo("Descripción", descripcion),
    h(
      "div",
      { class: "campo" },
      h("label", { texto: "Visibilidad" }),
      segmentos(
        [
          [true, "lock_open", "Público"],
          [false, "lock", "Privado"],
        ],
        true,
        (valor) => {
          publico = valor;
          explicar();
        }
      ),
      ayudaVisibilidad
    ),
    h("div", { class: "campo" }, h("label", { texto: "Retos del curso" }), listaRetos),
    boton
  );
  contenedor.replaceChildren(formulario);

  try {
    const retos = await api("/challenges");
    listaRetos.replaceChildren(
      ...(retos.length
        ? retos.map((reto) =>
            h(
              "label",
              { class: "fila clic", style: "margin-bottom:8px" },
              h("input", { type: "checkbox", value: reto.id }),
              h("div", { class: "fila-texto" }, h("p", { class: "fila-titulo", texto: reto.nombre }), h("p", { class: "fila-sub", texto: `${reto.dificultadNombre} · ${reto.lenguajeNombre}` }))
            )
          )
        : [h("p", { class: "meta", texto: "Aún no hay retos. Puedes crear el curso y agregarle retos después." })])
    );
  } catch (error) {
    listaRetos.replaceChildren(h("p", { class: "campo-error", texto: error.message }));
  }
}

// Formulario de reto. Con "existente" edita ese reto (PUT); sin él crea uno nuevo (POST).
async function formularioReto(contenedor, existente = null) {
  let lenguajes = [];
  let dificultades = [];
  try {
    [lenguajes, dificultades] = await Promise.all([obtenerLenguajes(), obtenerDificultades()]);
  } catch (error) {
    return contenedor.replaceChildren(vacio("cloud_off", error.message));
  }

  let dificultad = existente?.dificultad ?? dificultades[0]?.nivel;
  const nombre = h("input", { maxlength: "255", placeholder: "Ej: Suma de dos números", valor: existente?.nombre });
  const descripcion = h("textarea", { maxlength: "255", placeholder: "Explica qué debe leer y qué debe imprimir el programa" });
  const contador = h("span");
  const contar = () => (contador.textContent = `${descripcion.value.length}/255`);
  descripcion.addEventListener("input", contar);
  // Con estudiantes que ya intentaron el reto, su último código está en este lenguaje
  const lenguajeFijo = !!existente?.intentos;
  const lenguaje = h(
    "select",
    { disabled: lenguajeFijo },
    lenguajes.map((l) => h("option", { value: l.clave, selected: l.clave === existente?.lenguaje }, l.nombre))
  );
  const codigoInicial = h("textarea", { class: "codigo", spellcheck: "false", placeholder: "Código que verá el estudiante al abrir el reto (opcional)" });
  const solucion = h("textarea", { class: "codigo", spellcheck: "false", placeholder: "Tu solución (los estudiantes no la ven)" });
  const casos = h("div");
  let tocado = !!existente;

  descripcion.value = existente?.descripcion ?? "";
  contar();
  codigoInicial.value = existente ? existente.codigoInicial ?? "" : lenguajes[0]?.plantilla ?? "";
  solucion.value = existente?.solucion ?? "";
  codigoInicial.addEventListener("input", () => (tocado = true));
  lenguaje.addEventListener("change", () => {
    if (!tocado) codigoInicial.value = lenguajes.find((l) => l.clave === lenguaje.value)?.plantilla ?? "";
  });

  const agregarCaso = (entrada = "", salida = "") => {
    if (casos.children.length >= MAX_CASOS) return aviso(`Máximo ${MAX_CASOS} casos de prueba`, "error");
    const e = h("textarea", { class: "codigo", rows: "3", placeholder: "Entrada (stdin)", "aria-label": "Entrada" });
    const s = h("textarea", { class: "codigo", rows: "3", placeholder: "Salida esperada", "aria-label": "Salida esperada" });
    e.value = entrada;
    s.value = salida;
    const caso = h(
      "div",
      { class: "tarjeta caso", style: "margin:0 0 12px" },
      h(
        "div",
        { class: "acciones", style: "margin:0 0 8px" },
        h("strong", { class: "titulo-caso" }),
        h("button", { type: "button", class: "btn-icono", "aria-label": "Quitar caso", onclick: () => (caso.remove(), numerar()) }, icono("close"))
      ),
      h("div", { class: "campo", style: "margin-bottom:8px" }, e),
      h("div", { class: "campo", style: "margin:0" }, s)
    );
    caso.entrada = e;
    caso.salida = s;
    casos.append(caso);
    numerar();
  };
  const numerar = () => [...casos.children].forEach((c, i) => (c.querySelector(".titulo-caso").textContent = `Caso ${i + 1}`));
  if (existente?.listaCasos?.length) existente.listaCasos.forEach((caso) => agregarCaso(caso.entrada, caso.salida));
  else agregarCaso();

  // Ejecuta la solución con cada entrada y llena la salida esperada
  const calcular = h("button", { type: "button", class: "btn btn-chico btn-contorno" }, icono("bolt", "chico"), "Calcular salidas con la solución");
  calcular.addEventListener("click", () =>
    conCarga(calcular, async () => {
      if (!solucion.value.trim()) return aviso("Escribe primero la solución", "error");
      try {
        for (const [i, caso] of [...casos.children].entries()) {
          const r = await api("/compiler/run", { metodo: "POST", datos: { lenguaje: lenguaje.value, codigo: solucion.value, entrada: caso.entrada.value } });
          if (!r.exito) throw new Error(`Caso ${i + 1}: ${r.estado}. ${r.compilacion || r.salidaError}`.slice(0, 300));
          caso.salida.value = r.salida.trimEnd();
        }
        aviso("Salidas calculadas con tu solución", "exito");
      } catch (error) {
        aviso(error.message, "error");
      }
    })
  );

  const boton = h("button", { class: "btn btn-bloque", type: "submit" }, existente ? "Guardar cambios" : "Crear reto");
  const formulario = h(
    "form",
    {
      class: "tarjeta",
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const listaCasos = [...casos.children].map((c) => ({ entrada: c.entrada.value, salida: c.salida.value }));
        if (!nombre.value.trim() || !descripcion.value.trim() || !solucion.value.trim()) {
          return aviso("Completa el nombre, la descripción y la solución", "error");
        }
        if (!listaCasos.length || listaCasos.some((c) => !c.salida.trim())) {
          return aviso("Cada caso de prueba necesita su salida esperada", "error");
        }
        conCarga(boton, async () => {
          try {
            const r = await api(existente ? `/challenges/${existente.id}` : "/challenges", {
              metodo: existente ? "PUT" : "POST",
              datos: {
                nombre: nombre.value.trim(),
                descripcion: descripcion.value.trim(),
                dificultad,
                lenguaje: lenguaje.value,
                codigoInicial: codigoInicial.value,
                solucion: solucion.value,
                casos: listaCasos,
              },
            });
            aviso(existente ? "Cambios guardados" : "Reto creado", "exito");
            ir(`reto/${r.id}`);
          } catch (error) {
            aviso(error.message, "error");
          }
        });
      },
    },
    campo("Nombre del reto", nombre),
    h("div", { class: "campo" }, h("label", null, "Descripción", descripcion), h("p", { class: "campo-ayuda" }, contador)),
    h(
      "div",
      { class: "campo" },
      h("label", { texto: "Dificultad" }),
      segmentos(
        dificultades.map((d) => [d.nivel, null, `${d.nombre} · ${d.puntos}`]),
        dificultad,
        (valor) => (dificultad = valor)
      )
    ),
    campo(
      "Lenguaje",
      lenguaje,
      lenguajeFijo ? `No se puede cambiar: ${existente.intentos === 1 ? "1 estudiante ya intentó" : `${existente.intentos} estudiantes ya intentaron`} este reto.` : null
    ),
    campo("Código inicial", codigoInicial),
    campo("Solución del docente", solucion),
    h("h2", { class: "seccion-titulo", texto: "Casos de prueba" }),
    h("p", { class: "meta", style: "margin-bottom:12px", texto: `El reto se califica comparando la salida del estudiante con cada caso (1 a ${MAX_CASOS}).` }),
    casos,
    h(
      "div",
      { class: "acciones", style: "margin:0 0 20px" },
      h("button", { type: "button", class: "btn btn-chico btn-contorno", onclick: () => agregarCaso() }, icono("add", "chico"), "Agregar caso"),
      calcular
    ),
    boton
  );
  contenedor.replaceChildren(formulario);
}
