// Punto de entrada compartido por la web (/) y la app móvil (/movil/):
// sesión, rutas (#/pantalla/parametro), barra superior y barra de navegación.
import { api, sesion, hayToken, guardarToken } from "./api.js";
import { h, icono, ir, aviso, quitarAviso } from "./ui.js";
import { mostrarLogin, mostrarRegistro } from "./vistas/auth.js";
import * as inicio from "./vistas/inicio.js";
import * as explorar from "./vistas/explorar.js";
import * as crear from "./vistas/crear.js";
import * as guardados from "./vistas/guardados.js";
import * as perfil from "./vistas/perfil.js";
import * as ranking from "./vistas/ranking.js";
import * as cursos from "./vistas/cursos.js";
import * as editor from "./vistas/editor.js";
import * as buscar from "./vistas/buscar.js";
import * as notificaciones from "./vistas/notificaciones.js";

// Pestañas principales: barra inferior en el celular (como la app Flutter) y arriba en la web
const NAV = [
  ["inicio", "home", "Inicio"],
  ["explorar", "explore", "Explorar"],
  ["crear", "add_circle_outline", "Crear"],
  ["guardados", "bookmark_border", "Guardados"],
  ["perfil", "person_outline", "Perfil"],
];
const PRINCIPALES = new Set(NAV.map(([ruta]) => ruta));

const VISTAS = {
  inicio: inicio.mostrar,
  explorar: explorar.mostrar,
  crear: crear.mostrar,
  guardados: guardados.mostrar,
  perfil: perfil.mostrar,
  ranking: ranking.mostrar,
  curso: cursos.mostrar,
  reto: editor.mostrarReto,
  "editar-reto": crear.mostrarEdicion,
  editor: editor.mostrarLibre,
  buscar: buscar.mostrar,
  notificaciones: notificaciones.mostrar,
};

const app = document.getElementById("app");
let contenido = null;
let insignia = null;
let sondeo = null;
let limpiezas = [];
let generacion = 0;
let navegaciones = 0;

async function cargarUsuario() {
  if (sesion.usuario || !hayToken()) return;
  try {
    sesion.usuario = await api("/auth/profile");
  } catch (error) {
    // Token vencido o inválido: se descarta. Sin conexión se conserva para reintentar.
    if (error.status) guardarToken(null);
    else aviso(error.message, "error");
  }
}

async function actualizarInsignia() {
  if (!sesion.usuario || !insignia) return;
  try {
    const { noLeidas } = await api("/notifications");
    insignia.textContent = noLeidas > 9 ? "9+" : String(noLeidas);
    insignia.hidden = noLeidas === 0;
  } catch {
    /* se reintenta en el próximo sondeo */
  }
}

function montarEstructura() {
  if (contenido) return;

  const item = ([ruta, nombreIcono, texto], clase) =>
    h("button", { class: clase, "data-ruta": ruta, onclick: () => ir(ruta) }, icono(nombreIcono), h("span", { texto }));

  insignia = h("span", { class: "insignia", hidden: true });
  contenido = h("main", { class: "contenido" });

  app.replaceChildren(
    h(
      "div",
      { class: "app" },
      h(
        "header",
        { class: "barra" },
        h(
          "div",
          { class: "barra-fila" },
          h(
            "div",
            { class: "barra-izq" },
            h("button", { class: "btn-icono", id: "atras", "aria-label": "Atrás", onclick: () => (navegaciones > 1 ? history.back() : ir("inicio")) }, icono("arrow_back"))
          ),
          h("img", { class: "barra-logo", src: "/img/logo.png", alt: "CodeMaster - Inicio", onclick: () => ir("inicio") }),
          h("nav", { class: "nav-superior", "aria-label": "Secciones" }, NAV.map((n) => item(n, "pestana"))),
          h(
            "div",
            { class: "barra-der" },
            h("button", { class: "btn-icono", "data-ruta": "buscar", "aria-label": "Buscar", onclick: () => ir("buscar") }, icono("search")),
            h("button", { class: "btn-icono", "data-ruta": "ranking", "aria-label": "Ranking", onclick: () => ir("ranking") }, icono("emoji_events")),
            h(
              "button",
              { class: "btn-icono", "data-ruta": "notificaciones", "aria-label": "Notificaciones", onclick: () => ir("notificaciones") },
              icono("notifications_none"),
              insignia
            )
          )
        )
      ),
      contenido,
      h("nav", { class: "nav-inferior", "aria-label": "Secciones" }, NAV.map((n) => item(n, "nav-item")))
    )
  );

  sondeo = setInterval(actualizarInsignia, 60000);
}

function marcarNavegacion(nombre) {
  for (const boton of app.querySelectorAll("[data-ruta]")) {
    boton.classList.toggle(boton.classList.contains("pestana") ? "activa" : "activo", boton.dataset.ruta === nombre);
  }
  document.getElementById("atras").style.visibility = PRINCIPALES.has(nombre) ? "hidden" : "visible";
}

// Ejecuta la limpieza de la pantalla anterior (ej. cerrar el editor Monaco)
function salirDeVista() {
  for (const limpiar of limpiezas) {
    try {
      limpiar();
    } catch (error) {
      console.error(error);
    }
  }
  limpiezas = [];
  generacion++;
}

async function enrutar() {
  const [ruta, consulta = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [nombre, parametro] = ruta.split("/");
  navegaciones++;

  await cargarUsuario();

  if (!sesion.usuario) {
    salirDeVista();
    clearInterval(sondeo);
    contenido = null;
    document.body.classList.add("sin-nav");
    if (nombre === "registro") return mostrarRegistro(app, alEntrar);
    if (nombre !== "login") history.replaceState(null, "", "#/login");
    return mostrarLogin(app, alEntrar);
  }

  if (!VISTAS[nombre]) return ir("inicio");

  document.body.classList.remove("sin-nav");
  montarEstructura();
  marcarNavegacion(nombre);
  salirDeVista();

  // Cada pantalla se dibuja en su propio contenedor: si el usuario cambia de pantalla
  // antes de que termine de cargar, lo que llegue tarde no se mezcla con la nueva.
  const mia = generacion;
  const raiz = h("div", { class: "vista" });
  contenido.className = "contenido";
  contenido.replaceChildren(raiz);
  window.scrollTo(0, 0);

  const ctx = {
    activa: () => mia === generacion,
    alSalir: (limpiar) => (mia === generacion ? limpiezas.push(limpiar) : limpiar()),
    ancho: () => contenido.classList.add("ancho"),
  };

  actualizarInsignia();
  try {
    await VISTAS[nombre](raiz, parametro, new URLSearchParams(consulta), ctx);
  } catch (error) {
    console.error(error);
    aviso(error.message, "error");
  }
}

async function alEntrar() {
  sesion.usuario = null;
  await cargarUsuario();
  if (!sesion.usuario) throw new Error("No se pudo cargar tu perfil");
  quitarAviso(); // por ejemplo, el de un intento fallido anterior
  ir("inicio/recomendaciones");
}

window.addEventListener("hashchange", enrutar);
window.addEventListener("notificaciones-leidas", () => insignia && (insignia.hidden = true));
window.addEventListener("cerrar-sesion", () => {
  salirDeVista();
  clearInterval(sondeo);
  sesion.usuario = null;
  guardarToken(null);
  contenido = null;
  insignia = null;
  ir("login");
});

enrutar();
