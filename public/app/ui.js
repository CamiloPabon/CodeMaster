// Utilidades de interfaz compartidas por la web y la app móvil.
// Todo el contenido que viene del servidor se agrega como texto (nunca como HTML).

// Crea un elemento: h("button", { class: "btn", onclick }, "Texto", otroElemento)
export function h(etiqueta, props, ...hijos) {
  const el = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(props ?? {})) {
    if (valor == null || valor === false) continue;
    if (clave === "class") el.className = valor;
    else if (clave === "texto") el.textContent = valor;
    else if (clave === "valor") el.value = valor;
    else if (clave.startsWith("on")) el.addEventListener(clave.slice(2).toLowerCase(), valor);
    else el.setAttribute(clave, valor === true ? "" : valor);
  }

  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

export const icono = (nombre, clase = "") =>
  h("span", { class: `material-icons-outlined ${clase}`.trim(), "aria-hidden": "true" }, nombre);

// Navega a una pantalla (#/ruta). Si ya está ahí, la vuelve a cargar.
export const ir = (ruta) => {
  const destino = "#/" + ruta.replace(/^\/+/, "");
  if (location.hash === destino) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = destino;
};

// plural(1, "reto") -> "1 reto"; plural(3, "reto") -> "3 retos"
export const plural = (n, singular, varios = singular + "s") => `${n} ${n === 1 ? singular : varios}`;

// ["a", "b", "c"] -> "a, b o c"
export const listaTexto = (items, conjuncion = "o") =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${conjuncion} ${items[items.length - 1]}`;

// Colores de los banners de la app móvil original (y algunos más)
const COLORES = ["#1a237e", "#01579b", "#4a148c", "#004d40", "#b71c1c", "#e65100", "#33691e", "#37474f"];
export const colorPorId = (id) => COLORES[Math.abs(Number(id) || 0) % COLORES.length];

const iniciales = (nombre = "?") =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

export const avatar = (nombre, id, clase = "") =>
  h("span", { class: `avatar ${clase}`.trim(), style: `background:${colorPorId(id)}`, title: nombre }, iniciales(nombre));

// "Hace 3 minutos", "Ayer", "Hace 2 semanas"...
const relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const UNIDADES = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
export function hace(fecha) {
  const segundos = (new Date(fecha) - Date.now()) / 1000;
  for (const [unidad, duracion] of UNIDADES) {
    if (Math.abs(segundos) >= duracion) {
      const texto = relativo.format(Math.round(segundos / duracion), unidad);
      return texto[0].toUpperCase() + texto.slice(1);
    }
  }
  return "Hace un momento";
}

export const cargando = () => h("div", { class: "cargando" }, h("span", { class: "spinner oscuro" }));

export const vacio = (nombreIcono, texto, accion = null) =>
  h("div", { class: "vacio" }, icono(nombreIcono, "grande"), h("p", { texto }), accion);

export const mostrarError = (contenedor, error) => contenedor.replaceChildren(vacio("cloud_off", error.message));

// Pestañas estilo TabBar: [[clave, texto], ...]
export const pestanas = (opciones, activa, alCambiar) =>
  h(
    "div",
    { class: "pestanas", role: "tablist" },
    opciones.map(([clave, texto]) =>
      h(
        "button",
        { class: `pestana ${clave === activa ? "activa" : ""}`, role: "tab", "aria-selected": String(clave === activa), onclick: () => alCambiar(clave) },
        texto
      )
    )
  );

// Aviso en la parte inferior (SnackBar)
let temporizador = null;
export const quitarAviso = () => document.querySelector(".snackbar")?.remove();

export function aviso(mensaje, tipo = "") {
  document.querySelector(".snackbar")?.remove();
  const el = h("div", { class: `snackbar ${tipo}`.trim(), role: "status" }, mensaje);
  document.body.append(el);
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.remove(), tipo === "error" ? 4500 : 3200);
}

export function avisarLogros(logros = []) {
  logros.forEach((logro, i) =>
    setTimeout(() => aviso([icono(logro.icono), `¡Logro desbloqueado: ${logro.nombre}!`], "logro"), 600 + i * 3400)
  );
}

// Diálogo modal. Resuelve true (aceptar) o false (cancelar / tocar fuera)
export function dialogo({ titulo, contenido = null, aceptar = "Aceptar", cancelar = "Cancelar", peligro = false }) {
  return new Promise((resolver) => {
    const cerrar = (valor) => {
      fondo.remove();
      resolver(valor);
    };
    const fondo = h(
      "div",
      { class: "dialogo-fondo", onclick: (e) => e.target === fondo && cerrar(false) },
      h(
        "div",
        { class: "dialogo", role: "dialog", "aria-modal": "true" },
        h("h3", { texto: titulo }),
        contenido,
        h(
          "div",
          { class: "dialogo-acciones" },
          cancelar && h("button", { class: "btn-texto sin-linea", onclick: () => cerrar(false) }, cancelar),
          h("button", { class: `btn btn-chico ${peligro ? "btn-peligro" : ""}`, onclick: () => cerrar(true) }, aceptar)
        )
      )
    );
    fondo.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cerrar(false);
      if (e.key === "Enter" && e.target.tagName === "INPUT") cerrar(true);
    });
    document.body.append(fondo);
    (fondo.querySelector("input") || fondo.querySelector(".dialogo-acciones .btn"))?.focus();
  });
}

// Hoja de acciones inferior (menú "más opciones"): [[icono, texto, accion], ...]
export function hojaAcciones(opciones) {
  const cerrar = () => fondo.remove();
  const fondo = h(
    "div",
    { class: "hoja-fondo", onclick: (e) => e.target === fondo && cerrar() },
    h(
      "div",
      { class: "hoja", role: "menu" },
      opciones.map(([nombreIcono, texto, accion]) =>
        h(
          "button",
          {
            role: "menuitem",
            onclick: () => {
              cerrar();
              accion();
            },
          },
          icono(nombreIcono),
          texto
        )
      )
    )
  );
  document.body.append(fondo);
}

// Ejecuta una acción mostrando un spinner en el botón mientras termina
export async function conCarga(boton, accion) {
  const contenido = [...boton.childNodes];
  const fondoClaro = !boton.classList.contains("btn") || boton.classList.contains("btn-contorno");
  boton.disabled = true;
  boton.replaceChildren(h("span", { class: fondoClaro ? "spinner oscuro" : "spinner" }));
  try {
    return await accion();
  } finally {
    boton.disabled = false;
    boton.replaceChildren(...contenido);
  }
}

export function retrasar(funcion, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => funcion(...args), ms);
  };
}
