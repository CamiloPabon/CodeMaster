// Búsqueda de cursos y retos (botón de lupa de la barra superior)
import { api } from "../api.js";
import { h, icono, cargando, vacio, mostrarError, retrasar } from "../ui.js";
import { tarjetaCurso } from "./cursos.js";
import { tarjetaReto } from "./retos.js";

export function mostrar(contenedor, _parametro, consulta) {
  const input = h("input", { type: "search", placeholder: "Buscar cursos y retos", valor: consulta.get("q") || "", "aria-label": "Buscar" });
  const resultados = h("div");
  let busqueda = 0;

  const buscar = async () => {
    const q = input.value.trim();
    history.replaceState(null, "", `#/buscar?q=${encodeURIComponent(q)}`);
    if (!q) return resultados.replaceChildren(vacio("search", "Busca cursos y retos por nombre o descripción."));

    const mia = ++busqueda;
    resultados.replaceChildren(cargando());
    try {
      const qq = encodeURIComponent(q);
      const [cursos, retos] = await Promise.all([api(`/courses?q=${qq}`), api(`/challenges?q=${qq}`)]);
      if (mia !== busqueda) return;
      if (!cursos.length && !retos.length) return resultados.replaceChildren(vacio("search_off", `No encontramos resultados para "${q}".`));

      resultados.replaceChildren(
        ...(cursos.length > 0
          ? [h("h2", { class: "seccion-titulo", texto: `Cursos (${cursos.length})` }), h("div", { class: "rejilla" }, cursos.map((curso) => tarjetaCurso(curso)))]
          : []),
        ...(retos.length > 0
          ? [h("h2", { class: "seccion-titulo", texto: `Retos (${retos.length})` }), h("div", { class: "rejilla" }, retos.map((reto) => tarjetaReto(reto)))]
          : [])
      );
    } catch (error) {
      mostrarError(resultados, error);
    }
  };

  input.addEventListener("input", retrasar(buscar));
  contenedor.replaceChildren(h("div", { class: "buscador" }, icono("search"), input), resultados);
  buscar();
  setTimeout(() => input.focus(), 0);
}
