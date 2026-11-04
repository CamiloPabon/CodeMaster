// Service worker de la app móvil: guarda la interfaz (no los datos) para que
// abra rápido y muestre la pantalla aunque no haya conexión.
const VERSION = "codemaster-v3";
const INTERFAZ = [
  "/movil/",
  "/movil/manifest.webmanifest",
  "/app/tema.css",
  "/app/main.js",
  "/app/api.js",
  "/app/ui.js",
  "/app/vistas/auth.js",
  "/app/vistas/buscar.js",
  "/app/vistas/crear.js",
  "/app/vistas/cursos.js",
  "/app/vistas/editor.js",
  "/app/vistas/explorar.js",
  "/app/vistas/guardados.js",
  "/app/vistas/inicio.js",
  "/app/vistas/notificaciones.js",
  "/app/vistas/perfil.js",
  "/app/vistas/ranking.js",
  "/app/vistas/retos.js",
  "/img/logo.png",
  "/img/favicon.png",
  "/img/icono-192.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(INTERFAZ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((clave) => clave !== VERSION).map((clave) => caches.delete(clave))))
      .then(() => self.clients.claim())
  );
});

// Interfaz: primero la red (para ver siempre la última versión) y la copia guardada si no hay conexión.
// La API y los CDN (fuentes, Monaco) no pasan por aquí.
self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  const esInterfaz = evento.request.method === "GET" && url.origin === self.location.origin && /^\/(movil|app|img)\//.test(url.pathname);
  if (!esInterfaz) return;

  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(VERSION).then((cache) => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request).then((guardada) => guardada || caches.match("/movil/")))
  );
});
