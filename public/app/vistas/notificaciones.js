// Notificaciones (botón de campana de la barra superior)
import { api } from "../api.js";
import { h, icono, ir, hace, cargando, vacio, mostrarError } from "../ui.js";

const ICONOS = {
  like: "thumb_up",
  comentario: "chat_bubble_outline",
  union: "group_add",
  logro: "emoji_events",
  reto: "code",
  resuelto: "check_circle",
};

export async function mostrar(contenedor) {
  const lista = h("div", null, cargando());
  contenedor.replaceChildren(h("h1", { class: "titulo-vista", texto: "Notificaciones" }), lista);

  try {
    const { lista: notificaciones, noLeidas } = await api("/notifications");
    if (!notificaciones.length) return lista.replaceChildren(vacio("notifications_none", "No tienes notificaciones todavía."));

    lista.replaceChildren(
      ...notificaciones.map((n) =>
        h(
          "div",
          { class: `notificacion ${n.leida ? "" : "no-leida"}`, role: n.enlace ? "link" : null, onclick: () => n.enlace && ir(n.enlace) },
          h("span", { class: "icono-tipo" }, icono(ICONOS[n.tipo] ?? "notifications")),
          h("div", { class: "fila-texto" }, h("p", { texto: n.mensaje }), h("p", { class: "meta", style: "margin-top:4px", texto: hace(n.fecha) }))
        )
      )
    );

    // Al abrir la pantalla se marcan como leídas (se siguen viendo resaltadas hasta salir)
    if (noLeidas > 0) {
      await api("/notifications/read", { metodo: "POST" });
      window.dispatchEvent(new Event("notificaciones-leidas"));
    }
  } catch (error) {
    mostrarError(lista, error);
  }
}
