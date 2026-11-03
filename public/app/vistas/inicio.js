// Inicio: pestañas "Tus cursos", "Recomendaciones" y "Tus likes" (como home_screen.dart)
import { api, sesion } from "../api.js";
import { h, ir, pestanas, cargando, vacio, mostrarError } from "../ui.js";
import { tarjetaCurso } from "./cursos.js";

const PESTANAS = [
  ["mis", "Tus cursos"],
  ["recomendaciones", "Recomendaciones"],
  ["likes", "Tus likes"],
];

function sinCursos(pestana) {
  const verRecomendaciones = h("button", { class: "btn btn-chico", onclick: () => ir("inicio/recomendaciones") }, "Ver recomendaciones");
  if (pestana === "mis") return vacio("school", "Todavía no te has unido a ningún curso.", verRecomendaciones);
  if (pestana === "likes") return vacio("thumb_up", "Todavía no le has dado like a ningún curso.", verRecomendaciones);

  const puedeCrear = sesion.usuario.rol !== "estudiante";
  return vacio(
    "travel_explore",
    puedeCrear ? "Aún no hay cursos. ¡Crea el primero!" : "Aún no hay cursos publicados.",
    puedeCrear && h("button", { class: "btn btn-chico", onclick: () => ir("crear/curso") }, "Crear curso")
  );
}

export async function mostrar(contenedor, pestana) {
  const activa = PESTANAS.some(([clave]) => clave === pestana) ? pestana : "recomendaciones";
  const lista = h("div", null, cargando());
  contenedor.replaceChildren(pestanas(PESTANAS, activa, (clave) => ir(`inicio/${clave}`)), lista);

  try {
    const cursos = await api(`/courses?vista=${activa}`);
    if (!cursos.length) return lista.replaceChildren(sinCursos(activa));

    // En "Tus likes", al quitar el like la tarjeta desaparece de la lista
    const alQuitar = activa === "likes" ? (motivo, tarjeta) => motivo === "like" && tarjeta.remove() : null;
    lista.className = "rejilla";
    lista.replaceChildren(...cursos.map((curso) => tarjetaCurso(curso, alQuitar)));
  } catch (error) {
    mostrarError(lista, error);
  }
}
