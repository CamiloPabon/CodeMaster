// Tarjeta de un reto (Explorar, Guardados, Buscar y Mis retos) y acciones de su autor
import { api, obtenerLenguajes } from "../api.js";
import { h, icono, ir, aviso, dialogo, hojaAcciones, plural, listaTexto } from "../ui.js";

export const chipsReto = (reto) =>
  h(
    "div",
    { class: "chips" },
    h("span", { class: `chip dif-${reto.dificultad}` }, reto.dificultadNombre),
    h("span", { class: "chip" }, icono("code"), reto.lenguajeNombre),
    h("span", { class: "chip azul" }, icono("star"), `${reto.puntos} pts`),
    reto.resuelto && h("span", { class: "chip publico" }, icono("check_circle"), "Resuelto")
  );

export const autorReto = (reto) => (reto.creador ? `Creado por ${reto.creador}` : "Reto de ejemplo");

// Pide confirmación (con cuántos estudiantes perderían su progreso) y elimina el reto.
// Devuelve true si se eliminó.
export async function eliminarReto(retoId) {
  try {
    const reto = await api(`/challenges/${retoId}`);
    const advertencia = reto.intentos
      ? `${plural(reto.intentos, "estudiante tiene", "estudiantes tienen")} intentos en este reto: también se borrarán sus estadísticas y los puntos que ganaron.`
      : "Nadie lo ha intentado todavía.";
    const ok = await dialogo({
      titulo: `¿Eliminar "${reto.nombre}"?`,
      contenido: [h("p", { texto: advertencia }), h("p", { style: "margin-top:8px", texto: "También se quitará de los cursos donde esté. No se puede deshacer." })],
      aceptar: "Eliminar",
      peligro: true,
    });
    if (!ok) return false;

    await api(`/challenges/${retoId}`, { metodo: "DELETE" });
    aviso("Reto eliminado", "exito");
    return true;
  } catch (error) {
    aviso(error.message, "error");
    return false;
  }
}

export const menuAutor = (reto, alEliminar) =>
  hojaAcciones([
    ["edit", "Editar reto", () => ir(`editar-reto/${reto.id}`)],
    ["delete", "Eliminar reto", async () => (await eliminarReto(reto.id)) && alEliminar()],
  ]);

export function tarjetaReto(reto, alQuitarGuardado = null) {
  const tarjeta = h("article", { class: "tarjeta" });

  const alternarGuardado = async () => {
    try {
      const { guardado } = await api(`/challenges/${reto.id}/save`, { metodo: "POST" });
      reto.guardado = guardado;
      aviso(guardado ? "Reto guardado" : "Reto quitado de guardados");
      if (!guardado && alQuitarGuardado) return alQuitarGuardado(tarjeta);
      pintar();
    } catch (error) {
      aviso(error.message, "error");
    }
  };

  const pintar = () =>
    tarjeta.replaceChildren(
      h(
        "div",
        { class: "acciones", style: "margin:0;align-items:flex-start;flex-wrap:nowrap" },
        chipsReto(reto),
        reto.puedeEditar &&
          h("button", { class: "btn-icono", "aria-label": "Opciones del reto", onclick: () => menuAutor(reto, () => tarjeta.remove()) }, icono("more_horiz"))
      ),
      h("h3", { texto: reto.nombre }),
      h("p", { texto: reto.descripcion }),
      h("p", { class: "meta", style: "margin-top:8px", texto: autorReto(reto) }),
      h(
        "div",
        { class: "acciones" },
        h("button", { class: "btn btn-chico", onclick: () => ir(`reto/${reto.id}`) }, icono("play_arrow", "chico"), reto.resuelto ? "Practicar" : "Resolver"),
        h(
          "div",
          { class: "contadores" },
          h("span", { class: "meta", texto: reto.compilaciones ? plural(reto.compilaciones, "compilación", "compilaciones") : "Sin intentos" }),
          h(
            "button",
            { class: `contador ${reto.guardado ? "activo" : ""}`, "aria-label": reto.guardado ? "Quitar de guardados" : "Guardar reto", onclick: alternarGuardado },
            icono(reto.guardado ? "bookmark" : "bookmark_border")
          )
        )
      )
    );

  pintar();
  return tarjeta;
}

// Tarjeta para abrir el editor libre (los lenguajes salen de la base de datos)
export function tarjetaEditorLibre() {
  const subtitulo = h("p", { class: "tarjeta-sub", texto: "Escribe y ejecuta código" });
  obtenerLenguajes()
    .then((lenguajes) => (subtitulo.textContent = `Escribe y ejecuta código en ${listaTexto(lenguajes.map((l) => l.nombre))}`))
    .catch(() => {});

  return h(
    "article",
    { class: "tarjeta clic", role: "link", onclick: () => ir("editor") },
    h(
      "div",
      { class: "tarjeta-cabecera" },
      h("span", { class: "avatar", style: "background:var(--negro);color:var(--celeste)" }, icono("terminal")),
      h("div", { class: "texto" }, h("p", { class: "tarjeta-titulo", texto: "Editor libre" }), subtitulo),
      icono("chevron_right")
    )
  );
}
