// Perfil: datos del usuario, estadísticas, medallas, logros y cierre de sesión
import { api, sesion, cerrarSesion } from "../api.js";
import { h, icono, ir, avatar, dialogo, cargando, mostrarError, plural } from "../ui.js";

// Ícono de cada rol (el nombre que se muestra es el de la tabla rol)
const ICONO_ROL = { admin: "admin_panel_settings", docente: "school", estudiante: "person" };

const stat = (valor, etiqueta) => h("div", { class: "stat" }, h("p", { class: "stat-num", texto: String(valor) }), h("p", { class: "stat-label", texto: etiqueta }));

const fila = (nombreIcono, titulo, subtitulo, ruta, extra = null) =>
  h(
    "div",
    { class: "fila clic", role: "link", onclick: () => ir(ruta) },
    h("span", { class: "fila-num" }, icono(nombreIcono)),
    h("div", { class: "fila-texto" }, h("p", { class: "fila-titulo", texto: titulo }), h("p", { class: "fila-sub", texto: subtitulo }), extra),
    icono("chevron_right")
  );

export async function mostrar(contenedor) {
  contenedor.replaceChildren(cargando());
  let resumen;
  try {
    resumen = await api("/ranking/resumen");
  } catch (error) {
    return mostrarError(contenedor, error);
  }

  const usuario = sesion.usuario;
  const textoRol = usuario.rol[0].toUpperCase() + usuario.rol.slice(1);

  contenedor.replaceChildren(
    h(
      "div",
      { class: "perfil-cabecera" },
      avatar(usuario.nombre, usuario.id, "grande"),
      h("h1", { class: "perfil-nombre", texto: usuario.nombre }),
      h("p", { class: "texto-suave", texto: usuario.correo }),
      h("div", { class: "chips", style: "justify-content:center;margin-top:12px" }, h("span", { class: "chip negro" }, icono(ICONO_ROL[usuario.rol] ?? "person"), textoRol))
    ),
    h(
      "div",
      { class: "stats" },
      stat(resumen.puntos, "Puntos"),
      stat(resumen.posicion ? `#${resumen.posicion}` : "—", "Posición"),
      stat(resumen.resueltos, "Retos resueltos"),
      stat(resumen.compilaciones, "Compilaciones")
    ),
    h("h2", { class: "seccion-titulo", texto: "Tu progreso" }),
    fila(
      "leaderboard",
      "Tu puesto en el ranking",
      resumen.posicion ? `#${resumen.posicion} de ${resumen.totalEstudiantes} estudiantes` : "Los docentes y administradores no participan",
      "ranking"
    ),
    fila(
      "military_tech",
      "Medallas",
      resumen.medallas.map((m) => `${m.cantidad} ${m.medalla}`).join(" · "),
      "ranking/medallas"
    ),
    fila(
      "emoji_events",
      "Logros",
      `${resumen.logros} de ${resumen.totalLogros} desbloqueados`,
      "ranking/logros",
      h("div", { class: "barra-progreso" }, h("span", { style: `width:${Math.round((resumen.logros / Math.max(resumen.totalLogros, 1)) * 100)}%` }))
    ),
    fila("school", "Tus cursos", plural(resumen.cursos, "curso"), "inicio/mis"),
    h(
      "button",
      {
        class: "btn btn-bloque btn-contorno peligro",
        style: "margin-top:24px",
        onclick: async () => {
          if (await dialogo({ titulo: "¿Cerrar sesión?", aceptar: "Cerrar sesión", peligro: true })) cerrarSesion();
        },
      },
      icono("logout"),
      "Cerrar sesión"
    )
  );
}
