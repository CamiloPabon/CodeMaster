// Ranking con pestañas Ranking / Medallas / Logros (como Ranking_screen.dart)
import { api, sesion, obtenerDificultades } from "../api.js";
import { h, icono, ir, hace, pestanas, cargando, vacio, mostrarError, plural, listaTexto } from "../ui.js";

const PESTANAS = [
  ["ranking", "Ranking"],
  ["medallas", "Medallas"],
  ["logros", "Logros"],
];

const COLOR_TOP = ["#f9a825", "#9e9e9e", "#a1663f"];

const filaRanking = (f) =>
  h(
    "div",
    { class: `fila ${f.id === sesion.usuario.id ? "yo" : ""}` },
    h("span", { class: "fila-num", texto: String(f.posicion) }),
    h(
      "div",
      { class: "fila-texto" },
      h("p", { class: "fila-titulo", texto: f.id === sesion.usuario.id ? `${f.nombre} (tú)` : f.nombre }),
      h("p", { class: "fila-sub", texto: `${f.puntos} puntos · ${plural(f.resueltos, "reto resuelto", "retos resueltos")}` })
    ),
    f.posicion <= 3 ? h("span", { style: `color:${COLOR_TOP[f.posicion - 1]}` }, icono("emoji_events")) : icono("chevron_right")
  );

async function ranking() {
  const [{ yo, top }, dificultades] = await Promise.all([api("/ranking"), obtenerDificultades()]);
  const reglas = listaTexto(dificultades.map((d) => `${d.puntos} (${d.nombre.toLowerCase()})`));
  return [
    h("h2", { class: "seccion-titulo", texto: "Tu puesto en el ranking" }),
    h(
      "div",
      { class: "puesto" },
      h("p", { class: "puesto-num", texto: yo ? `#${yo.posicion}` : "—" }),
      h("p", { class: "puesto-sub", texto: yo ? `${yo.puntos} puntos · ${plural(yo.resueltos, "reto resuelto", "retos resueltos")}` : "Los docentes y administradores no participan en el ranking" })
    ),
    h("p", { class: "meta", style: "text-align:center", texto: `Cada reto resuelto suma ${reglas} puntos.` }),
    h("h2", { class: "seccion-titulo", texto: "Top 3" }),
    top.length ? top.slice(0, 3).map(filaRanking) : vacio("leaderboard", "Aún no hay estudiantes en el ranking."),
    top.length > 3 && [h("h2", { class: "seccion-titulo", texto: "Otros participantes" }), top.slice(3).map(filaRanking)],
  ];
}

async function medallas() {
  const datos = await api("/ranking/medallas");
  // Tipos de medalla de la tabla dificultad, de la mayor a la menor
  const resumen = h(
    "div",
    { class: "medallas" },
    datos.resumen.map((m) =>
      h(
        "div",
        null,
        h("div", { class: `medalla ${m.medalla}` }, icono("military_tech")),
        h("strong", { texto: String(m.cantidad) }),
        h("p", { class: "meta", texto: m.medalla[0].toUpperCase() + m.medalla.slice(1) })
      )
    )
  );
  const reglas = listaTexto([...datos.resumen].reverse().map((m) => `${m.medalla} (${m.dificultad.toLowerCase()})`), "u");

  return [
    resumen,
    h("p", { class: "meta", style: "text-align:center;margin-bottom:20px", texto: `Ganas una medalla por cada reto resuelto: ${reglas}.` }),
    datos.lista.length
      ? datos.lista.map((m) =>
          h(
            "div",
            { class: "fila clic", onclick: () => ir(`reto/${m.id}`) },
            h("div", { class: `medalla chica ${m.medalla}` }, icono("military_tech", "chico")),
            h(
              "div",
              { class: "fila-texto" },
              h("p", { class: "fila-titulo", texto: m.reto }),
              h("p", { class: "fila-sub", texto: `${m.dificultadNombre} · +${m.puntos} puntos · ${hace(m.fecha)}` })
            ),
            icono("chevron_right")
          )
        )
      : vacio("military_tech", "Resuelve tu primer reto para ganar una medalla.", h("button", { class: "btn btn-chico", onclick: () => ir("explorar") }, "Explorar retos")),
  ];
}

async function logros() {
  const datos = await api("/ranking/logros");
  return [
    h("p", { class: "meta", texto: `${datos.desbloqueados} de ${datos.total} logros desbloqueados` }),
    h("div", { class: "barra-progreso", style: "margin-bottom:20px" }, h("span", { style: `width:${Math.round((datos.desbloqueados / Math.max(datos.total, 1)) * 100)}%` })),
    h(
      "div",
      { class: "logros" },
      datos.lista.map((l) =>
        h(
          "div",
          { class: `logro ${l.desbloqueado ? "" : "bloqueado"}` },
          h("div", { class: "logro-icono" }, icono(l.desbloqueado ? l.icono : "lock")),
          h("p", { class: "logro-nombre", texto: l.nombre }),
          h("p", { class: "logro-desc", texto: l.descripcion }),
          l.desbloqueado && h("p", { class: "meta", style: "margin-top:6px", texto: hace(l.fecha) })
        )
      )
    ),
  ];
}

const CONTENIDO = { ranking, medallas, logros };

export async function mostrar(contenedor, pestana) {
  const activa = CONTENIDO[pestana] ? pestana : "ranking";
  const cuerpo = h("div", null, cargando());
  contenedor.replaceChildren(pestanas(PESTANAS, activa, (clave) => ir(`ranking/${clave}`)), cuerpo);

  try {
    cuerpo.replaceChildren(h("div", null, await CONTENIDO[activa]()));
  } catch (error) {
    mostrarError(cuerpo, error);
  }
}
