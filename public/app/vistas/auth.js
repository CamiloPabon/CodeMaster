// Pantallas de ingreso y registro (como login_screen.dart y register_screen.dart de la app Flutter)
import { api, guardarToken } from "../api.js";
import { h, icono, aviso, ir } from "../ui.js";

const EMAIL = /^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$/;

// Campo con validación que muestra el error debajo, como TextFormField
function campo({ tipo = "text", placeholder, autocompletar, validar, conOjo = false }) {
  const input = h("input", { type: tipo, placeholder, autocomplete: autocompletar, "aria-label": placeholder });
  const error = h("p", { class: "campo-error", hidden: true });
  const contenedor = h("div", { class: `campo ${conOjo ? "con-icono" : ""}` }, input);

  if (conOjo) {
    const ojo = h("button", { type: "button", class: "btn-icono campo-icono", "aria-label": "Mostrar contraseña" }, icono("visibility_off"));
    ojo.addEventListener("click", () => {
      const oculto = input.type === "password";
      input.type = oculto ? "text" : "password";
      ojo.replaceChildren(icono(oculto ? "visibility" : "visibility_off"));
    });
    contenedor.append(ojo);
  }
  contenedor.append(error);

  return {
    elemento: contenedor,
    valor: () => input.value.trim(),
    valido() {
      const mensaje = validar(input.value.trim());
      contenedor.classList.toggle("invalido", !!mensaje);
      error.hidden = !mensaje;
      error.textContent = mensaje || "";
      return !mensaje;
    },
  };
}

const validarEmail = (v) => (!v ? "Por favor ingresa tu email" : !EMAIL.test(v) ? "Ingresa un email válido" : null);
const validarClave = (v) =>
  !v ? "Por favor ingresa tu contraseña" : v.length < 6 ? "La contraseña debe tener al menos 6 caracteres" : null;

function pantalla(titulo, ayuda, campos, textoEnlace, rutaEnlace, alEnviar) {
  const boton = h("button", { type: "submit", class: "btn btn-bloque" }, "Continuar");
  const enlace = h("button", { type: "button", class: "btn-texto", onclick: () => ir(rutaEnlace) }, textoEnlace);

  const formulario = h(
    "form",
    {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const validos = campos.map((c) => c.valido()).every(Boolean);
        if (!validos) return;

        boton.disabled = true;
        enlace.disabled = true;
        boton.replaceChildren(h("span", { class: "spinner" }));
        try {
          await alEnviar();
        } catch (error) {
          aviso(error.message, "error");
        } finally {
          boton.disabled = false;
          enlace.disabled = false;
          boton.replaceChildren("Continuar");
        }
      },
    },
    campos.map((c) => c.elemento),
    boton
  );

  return h(
    "div",
    { class: "auth" },
    h(
      "div",
      { class: "auth-caja" },
      h("img", { class: "auth-logo", src: "/img/logo.png", alt: "CodeMaster" }),
      h("h1", { class: "auth-lema", texto: "CODEA. COMPITE. GANA." }),
      h("h2", { class: "auth-titulo", texto: titulo }),
      h("p", { class: "auth-ayuda", texto: ayuda }),
      formulario,
      enlace
    )
  );
}

async function entrar(correo, password, alEntrar) {
  const { token } = await api("/auth/login", { metodo: "POST", datos: { correo, password } });
  guardarToken(token);
  await alEntrar();
}

export function mostrarLogin(app, alEntrar) {
  const email = campo({ tipo: "email", placeholder: "Introduce tu email", autocompletar: "email", validar: validarEmail });
  const clave = campo({ tipo: "password", placeholder: "Contraseña", autocompletar: "current-password", validar: validarClave, conOjo: true });

  app.replaceChildren(
    pantalla("Ingresar a CodeMaster", "Introduce tus datos para entrar", [email, clave], "¿Aún no tienes una cuenta? Regístrate aquí", "registro", () =>
      entrar(email.valor(), clave.valor(), alEntrar)
    )
  );
}

export function mostrarRegistro(app, alEntrar) {
  const nombre = campo({ placeholder: "Nombre", autocompletar: "name", validar: (v) => (!v ? "Por favor ingresa tu nombre" : null) });
  const email = campo({ tipo: "email", placeholder: "Introduce tu email", autocompletar: "email", validar: validarEmail });
  const clave = campo({ tipo: "password", placeholder: "Contraseña", autocompletar: "new-password", validar: validarClave, conOjo: true });

  app.replaceChildren(
    pantalla("Crea tu cuenta", "Introduce tus datos para registrarte", [nombre, email, clave], "¿Ya tienes una cuenta? Ingresa aquí", "login", async () => {
      await api("/auth/register", { metodo: "POST", datos: { nombre: nombre.valor(), correo: email.valor(), password: clave.valor() } });
      await entrar(email.valor(), clave.valor(), alEntrar);
    })
  );
}
