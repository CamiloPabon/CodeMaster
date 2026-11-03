// Explorar: buscar y filtrar retos, y acceso al editor libre
import { api } from "../api.js";
import { h, icono, cargando, vacio, mostrarError, retrasar } from "../ui.js";
import { tarjetaReto, tarjetaEditorLibre } from "./retos.js";

const FILTROS = [
  ["", "Todos"],
  ["pendientes", "Por resolver"],
  ["resueltos", "Resueltos"],
  ["guardados", "Guardados"],
];

// Se conserva al volver a la pestaña
const estado = { q: "", filtro: "" };

export function mostrar(contenedor) {
  const input = h("input", { type: "search", placeholder: "Buscar retos", valor: estado.q, "aria-label": "Buscar retos" });
  const filtros = h("div", { class: "filtros", role: "group", "aria-label": "Filtrar retos" });
  const lista = h("div");
  let consulta = 0;

  const cargar = async () => {
    const mia = ++consulta;
    lista.className = "";
    lista.replaceChildren(cargando());
    try {
      const retos = await api(`/challenges?q=${encodeURIComponent(estado.q)}&filtro=${estado.filtro}`);
      if (mia !== consulta) return; // llegó una búsqueda más reciente
      if (!retos.length) return lista.replaceChildren(vacio("search_off", "No hay retos con ese filtro."));
      lista.className = "rejilla";
      lista.replaceChildren(...retos.map((reto) => tarjetaReto(reto)));
    } catch (error) {
      mostrarError(lista, error);
    }
  };

  const pintarFiltros = () =>
    filtros.replaceChildren(
      ...FILTROS.map(([clave, texto]) =>
        h(
          "button",
          {
            class: `filtro ${estado.filtro === clave ? "activo" : ""}`,
            "aria-pressed": String(estado.filtro === clave),
            onclick: () => {
              estado.filtro = clave;
              pintarFiltros();
              cargar();
            },
          },
          texto
        )
      )
    );

  input.addEventListener(
    "input",
    retrasar(() => {
      estado.q = input.value.trim();
      cargar();
    })
  );

  pintarFiltros();
  contenedor.replaceChildren(
    h("h1", { class: "titulo-vista", texto: "Explorar" }),
    h("div", { class: "buscador" }, icono("search"), input),
    filtros,
    tarjetaEditorLibre(),
    h("h2", { class: "seccion-titulo", texto: "Retos" }),
    lista
  );
  cargar();
}
