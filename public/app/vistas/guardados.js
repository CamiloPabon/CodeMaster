// Guardados: cursos y retos que el usuario marcó para después
import { api } from "../api.js";
import { h, ir, pestanas, cargando, vacio, mostrarError } from "../ui.js";
import { tarjetaCurso } from "./cursos.js";
import { tarjetaReto } from "./retos.js";

const PESTANAS = [
  ["cursos", "Cursos"],
  ["retos", "Retos"],
];

export async function mostrar(contenedor, pestana) {
  const activa = pestana === "retos" ? "retos" : "cursos";
  const lista = h("div", null, cargando());
  contenedor.replaceChildren(pestanas(PESTANAS, activa, (clave) => ir(`guardados/${clave}`)), lista);

  const sinGuardados = () =>
    lista.replaceChildren(
      vacio(
        "bookmark_border",
        activa === "cursos" ? "No tienes cursos guardados. Usa el menú ⋯ de un curso para guardarlo." : "No tienes retos guardados. Toca el marcador de un reto para guardarlo.",
        h("button", { class: "btn btn-chico", onclick: () => ir(activa === "cursos" ? "inicio" : "explorar") }, activa === "cursos" ? "Ver cursos" : "Explorar retos")
      )
    );

  // Al quitar un elemento de guardados desaparece de la lista
  const quitar = (tarjeta) => {
    tarjeta.remove();
    if (!lista.children.length) sinGuardados();
  };

  try {
    const elementos =
      activa === "cursos"
        ? (await api("/courses?vista=guardados")).map((curso) => tarjetaCurso(curso, (motivo, tarjeta) => motivo === "guardado" && quitar(tarjeta)))
        : (await api("/challenges?filtro=guardados")).map((reto) => tarjetaReto(reto, quitar));

    if (!elementos.length) return sinGuardados();
    lista.className = "rejilla";
    lista.replaceChildren(...elementos);
  } catch (error) {
    mostrarError(lista, error);
  }
}
