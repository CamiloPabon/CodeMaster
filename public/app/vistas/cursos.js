// Cursos: tarjeta del feed (como _buildCourseItem de la app Flutter) y pantalla de detalle
import { api, sesion } from "../api.js";
import {
  h, icono, ir, avatar, colorPorId, hace, aviso, avisarLogros, dialogo, hojaAcciones,
  conCarga, cargando, vacio, mostrarError, plural,
} from "../ui.js";

const chipVisibilidad = (publico) =>
  h("span", { class: `chip ${publico ? "publico" : "privado"}` }, icono(publico ? "lock_open" : "lock"), publico ? "Curso público" : "Curso privado");

// Pide el código si el curso es privado. Devuelve true si el usuario quedó unido.
export async function unirseACurso(curso) {
  let codigo;
  if (!curso.publico) {
    const input = h("input", { placeholder: "Código de acceso", maxlength: "10", autocomplete: "off", style: "text-transform:uppercase" });
    const aceptado = await dialogo({
      titulo: "Curso privado",
      contenido: [h("p", { texto: "Pídele a tu docente el código de acceso del curso." }), h("div", { class: "campo" }, input)],
      aceptar: "Unirme",
    });
    if (!aceptado) return false;
    codigo = input.value.trim();
  }

  const respuesta = await api(`/courses/${curso.id}/join`, { metodo: "POST", datos: { codigo } });
  curso.unido = true;
  curso.miembros = respuesta.miembros;
  aviso(`Te uniste a "${curso.nombre}"`, "exito");
  avisarLogros(respuesta.nuevosLogros);
  return true;
}

async function alternarLike(curso) {
  const respuesta = await api(`/courses/${curso.id}/like`, { metodo: "POST" });
  curso.meGusta = respuesta.meGusta;
  curso.likes = respuesta.likes;
}

async function alternarGuardado(curso) {
  const respuesta = await api(`/courses/${curso.id}/save`, { metodo: "POST" });
  curso.guardado = respuesta.guardado;
  aviso(curso.guardado ? "Curso guardado" : "Curso quitado de guardados");
}

// Ejecuta una acción y repinta; los errores se muestran como aviso
const accion = (fn, repintar) => async () => {
  try {
    await fn();
    repintar();
  } catch (error) {
    aviso(error.message, "error");
  }
};

function botonUnirse(curso, repintar) {
  if (curso.creadorId === sesion.usuario.id) {
    return h("button", { class: "btn btn-chico btn-contorno", onclick: () => ir(`curso/${curso.id}`) }, icono("school", "chico"), "Tu curso");
  }
  if (curso.unido) {
    return h("button", { class: "btn btn-chico btn-contorno", onclick: () => ir(`curso/${curso.id}`) }, icono("check", "chico"), "Unido");
  }
  const boton = h("button", { class: "btn btn-chico btn-secundario" }, icono("link", "chico"), "Unirse");
  boton.addEventListener("click", () =>
    conCarga(boton, async () => {
      try {
        if (await unirseACurso(curso)) repintar();
      } catch (error) {
        aviso(error.message, "error");
      }
    })
  );
  return boton;
}

export function tarjetaCurso(curso, alQuitar = null) {
  const tarjeta = h("article", { class: "tarjeta" });
  const abrir = () => ir(`curso/${curso.id}`);

  const pintar = () =>
    tarjeta.replaceChildren(
      h(
        "div",
        { class: "tarjeta-cabecera" },
        avatar(curso.creador, curso.creadorId),
        h(
          "div",
          { class: "texto" },
          h("p", { class: "tarjeta-titulo", texto: `${curso.creador} creó el curso ${curso.nombre}` }),
          h("p", { class: "tarjeta-sub", texto: hace(curso.fecha) })
        ),
        h(
          "button",
          {
            class: "btn-icono",
            "aria-label": "Más opciones",
            onclick: () =>
              hojaAcciones([
                ["open_in_new", "Ver curso", abrir],
                [
                  curso.guardado ? "bookmark_remove" : "bookmark_border",
                  curso.guardado ? "Quitar de guardados" : "Guardar curso",
                  accion(async () => {
                    await alternarGuardado(curso);
                    if (!curso.guardado) alQuitar?.("guardado", tarjeta);
                  }, pintar),
                ],
              ]),
          },
          icono("more_horiz")
        )
      ),
      h("div", { class: "banner", style: `background:${colorPorId(curso.id)}`, role: "link", onclick: abrir }, curso.nombre),
      h("div", { class: "chips" }, chipVisibilidad(curso.publico), curso.retos > 0 && h("span", { class: "chip" }, icono("code"), plural(curso.retos, "reto"))),
      h(
        "div",
        { class: "acciones" },
        botonUnirse(curso, pintar),
        h(
          "div",
          { class: "contadores" },
          h(
            "button",
            {
              class: `contador ${curso.meGusta ? "activo" : ""}`,
              "aria-label": "Me gusta",
              "aria-pressed": String(curso.meGusta),
              onclick: accion(async () => {
                await alternarLike(curso);
                if (!curso.meGusta) alQuitar?.("like", tarjeta);
              }, pintar),
            },
            icono("thumb_up"),
            String(curso.likes)
          ),
          h("button", { class: "contador", "aria-label": "Comentarios", onclick: abrir }, icono("chat_bubble_outline"), String(curso.comentarios))
        )
      )
    );

  pintar();
  return tarjeta;
}

// ---------------------------------------------------------------------
// Detalle del curso: #/curso/:id
// ---------------------------------------------------------------------
export async function mostrar(contenedor, id) {
  contenedor.replaceChildren(cargando());
  let curso;
  try {
    curso = await api(`/courses/${id}`);
  } catch (error) {
    return mostrarError(contenedor, error);
  }

  const cabecera = h("section");
  const cuerpo = h("section");
  const recargar = () => mostrar(contenedor, id);

  // h() descarta null/false; replaceChildren los convertiría en texto, por eso el filter
  const pintarCabecera = () =>
    cabecera.replaceChildren(
      ...[
      h("div", { class: "banner", style: `background:${colorPorId(curso.id)};cursor:default` }, curso.nombre),
      h(
        "div",
        { class: "tarjeta-cabecera" },
        avatar(curso.creador, curso.creadorId),
        h(
          "div",
          { class: "texto" },
          h("p", { class: "tarjeta-titulo", texto: `Creado por ${curso.creador}` }),
          h("p", { class: "tarjeta-sub", texto: hace(curso.fecha) })
        )
      ),
      curso.descripcion && h("p", { class: "texto-suave", style: "margin:14px 0 0;line-height:1.5", texto: curso.descripcion }),
      h(
        "div",
        { class: "chips", style: "margin-top:14px" },
        chipVisibilidad(curso.publico),
        h("span", { class: "chip" }, icono("group"), plural(curso.miembros, "miembro")),
        h("span", { class: "chip" }, icono("code"), plural(curso.retos, "reto"))
      ),
      h(
        "div",
        { class: "acciones" },
        accionesMiembro(curso, recargar),
        h(
          "div",
          { class: "contadores" },
          h(
            "button",
            { class: `contador ${curso.meGusta ? "activo" : ""}`, "aria-label": "Me gusta", onclick: accion(() => alternarLike(curso), pintarCabecera) },
            icono("thumb_up"),
            String(curso.likes)
          ),
          h("span", { class: "contador" }, icono("chat_bubble_outline"), String(curso.comentarios)),
          h(
            "button",
            { class: `contador ${curso.guardado ? "activo" : ""}`, "aria-label": "Guardar", onclick: accion(() => alternarGuardado(curso), pintarCabecera) },
            icono(curso.guardado ? "bookmark" : "bookmark_border")
          )
        )
      ),
      curso.gestiona && panelCreador(curso),
      ].filter(Boolean)
    );

  pintarCabecera();

  if (!curso.puedeVer) {
    cuerpo.replaceChildren(vacio("lock", "Este curso es privado. Únete con el código de acceso para ver sus retos y comentarios."));
  } else {
    cuerpo.replaceChildren(await seccionRetos(curso, recargar), seccionComentarios(curso, pintarCabecera));
  }

  contenedor.replaceChildren(h("article", { class: "tarjeta" }, cabecera), cuerpo);
}

function accionesMiembro(curso, recargar) {
  if (curso.esCreador) return h("span", { class: "chip negro" }, icono("school"), "Eres el creador");
  if (!curso.unido) {
    const boton = h("button", { class: "btn btn-chico btn-secundario" }, icono("link", "chico"), "Unirse");
    boton.addEventListener("click", () =>
      conCarga(boton, async () => {
        try {
          if (await unirseACurso(curso)) recargar();
        } catch (error) {
          aviso(error.message, "error");
        }
      })
    );
    return boton;
  }
  return h(
    "button",
    {
      class: "btn btn-chico btn-contorno",
      onclick: async () => {
        const ok = await dialogo({ titulo: "¿Salir del curso?", contenido: h("p", { texto: `Dejarás de ver "${curso.nombre}" en Tus cursos.` }), aceptar: "Salir", peligro: true });
        if (!ok) return;
        try {
          await api(`/courses/${curso.id}/join`, { metodo: "DELETE" });
          aviso("Saliste del curso");
          recargar();
        } catch (error) {
          aviso(error.message, "error");
        }
      },
    },
    icono("check", "chico"),
    "Unido"
  );
}

function panelCreador(curso) {
  return h(
    "div",
    { style: "margin-top:16px;padding-top:16px;border-top:1px solid var(--gris-200)" },
    !curso.publico &&
      h(
        "div",
        null,
        h("p", { class: "meta", texto: "Código de acceso para tus estudiantes:" }),
        h("div", { class: "codigo-acceso", texto: curso.codigoAcceso }),
        h(
          "button",
          {
            class: "btn-texto sin-linea",
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(curso.codigoAcceso);
                aviso("Código copiado");
              } catch {
                aviso("Copia el código manualmente: " + curso.codigoAcceso);
              }
            },
          },
          icono("content_copy", "chico"),
          " Copiar código"
        )
      ),
    h(
      "button",
      {
        class: "btn btn-chico btn-contorno peligro",
        style: "margin-top:8px",
        onclick: async () => {
          const ok = await dialogo({
            titulo: "¿Eliminar el curso?",
            contenido: h("p", { texto: "Se borrarán sus comentarios, likes y miembros. Los retos no se eliminan." }),
            aceptar: "Eliminar",
            peligro: true,
          });
          if (!ok) return;
          try {
            await api(`/courses/${curso.id}`, { metodo: "DELETE" });
            aviso("Curso eliminado");
            ir("inicio/mis");
          } catch (error) {
            aviso(error.message, "error");
          }
        },
      },
      icono("delete", "chico"),
      "Eliminar curso"
    )
  );
}

async function seccionRetos(curso, recargar) {
  const filas = curso.listaRetos.map((reto) =>
    h(
      "div",
      { class: "fila clic", onclick: () => ir(`reto/${reto.id}`) },
      h("span", { class: "fila-num" }, icono(reto.resuelto ? "check" : "code")),
      h(
        "div",
        { class: "fila-texto" },
        h("p", { class: "fila-titulo", texto: reto.nombre }),
        h("p", { class: "fila-sub", texto: `${reto.dificultadNombre} · ${reto.lenguajeNombre}${reto.resuelto ? " · Resuelto" : ""}` })
      ),
      curso.gestiona &&
        h(
          "button",
          {
            class: "btn-icono",
            "aria-label": "Quitar del curso",
            onclick: async (e) => {
              e.stopPropagation();
              try {
                await api(`/courses/${curso.id}/challenges/${reto.id}`, { metodo: "DELETE" });
                recargar();
              } catch (error) {
                aviso(error.message, "error");
              }
            },
          },
          icono("remove_circle_outline")
        ),
      icono("chevron_right")
    )
  );

  let agregar = null;
  if (curso.gestiona) {
    const todos = await api("/challenges").catch(() => []);
    const disponibles = todos.filter((r) => !curso.listaRetos.some((x) => x.id === r.id));
    if (disponibles.length) {
      const select = h("select", { "aria-label": "Reto para agregar" }, disponibles.map((r) => h("option", { value: r.id }, `${r.nombre} (${r.dificultadNombre})`)));
      const boton = h("button", { class: "btn btn-chico" }, icono("add", "chico"), "Agregar");
      boton.addEventListener("click", () =>
        conCarga(boton, async () => {
          try {
            await api(`/courses/${curso.id}/challenges`, { metodo: "POST", datos: { challengeId: Number(select.value) } });
            aviso("Reto agregado; avisamos a los miembros del curso", "exito");
            recargar();
          } catch (error) {
            aviso(error.message, "error");
          }
        })
      );
      agregar = h("div", { class: "barra-editor" }, h("div", { class: "campo", style: "flex:1" }, select), boton);
    }
  }

  return h(
    "div",
    null,
    h("h2", { class: "seccion-titulo", texto: "Retos del curso" }),
    agregar,
    filas.length ? filas : vacio("code_off", "Este curso todavía no tiene retos.")
  );
}

function seccionComentarios(curso, pintarCabecera) {
  const lista = h("div");
  const texto = h("textarea", { placeholder: "Escribe un comentario...", maxlength: "500", rows: "2", "aria-label": "Comentario" });
  const enviar = h("button", { class: "btn", "aria-label": "Publicar comentario" }, icono("send"));

  const filaComentario = (c) => {
    const puedeBorrar = c.autorId === sesion.usuario.id || curso.gestiona;
    const fila = h(
      "div",
      { class: "comentario" },
      avatar(c.autor, c.autorId, "chico"),
      h(
        "div",
        { class: "texto" },
        h("p", null, h("span", { class: "comentario-autor", texto: c.autor }), h("span", { class: "meta", texto: ` · ${hace(c.fecha)}` })),
        h("p", { class: "comentario-cuerpo", texto: c.contenido })
      ),
      puedeBorrar &&
        h(
          "button",
          {
            class: "btn-icono",
            "aria-label": "Eliminar comentario",
            onclick: async () => {
              try {
                await api(`/courses/${curso.id}/comments/${c.id}`, { metodo: "DELETE" });
                fila.remove();
                curso.comentarios--;
                pintarCabecera();
              } catch (error) {
                aviso(error.message, "error");
              }
            },
          },
          icono("delete")
        )
    );
    return fila;
  };

  const pintarLista = () =>
    lista.replaceChildren(...(curso.listaComentarios.length ? curso.listaComentarios.map(filaComentario) : [vacio("forum", "Sé el primero en comentar.")]));

  enviar.addEventListener("click", () =>
    conCarga(enviar, async () => {
      if (!texto.value.trim()) return;
      try {
        const { comentario, nuevosLogros } = await api(`/courses/${curso.id}/comments`, { metodo: "POST", datos: { contenido: texto.value } });
        texto.value = "";
        curso.listaComentarios.unshift(comentario);
        curso.comentarios++;
        pintarLista();
        pintarCabecera();
        avisarLogros(nuevosLogros);
      } catch (error) {
        aviso(error.message, "error");
      }
    })
  );

  pintarLista();
  return h(
    "div",
    { id: "comentarios" },
    h("h2", { class: "seccion-titulo", texto: "Comentarios" }),
    h("div", { class: "nuevo-comentario" }, h("div", { class: "campo" }, texto), enviar),
    h("div", { class: "tarjeta" }, lista)
  );
}
