/* Hybrid Train — service worker.
   Objetivo: que la app abra al instante y siga funcionando en un box sin
   cobertura. No guarda tus datos (eso es localStorage, dentro de la app):
   guarda los ARCHIVOS con los que la app se dibuja.

   Tres políticas distintas, porque no todo se comporta igual:

   1. La pantalla (index.html) va de caché primero. Es lo que hace que abra
      instantánea. Se compara ignorando la query, así que ?plan=angel entra por
      la misma puerta que la raíz.
   2. Los planes (planes/*.json) van de red primero, con la caché de respaldo.
      Si cambias el plan de alguien, esa persona lo ve al abrir, no un día
      después. Y sin red, se usa la última copia que se descargó.
   3. Iconos y manifest, de caché.

   Si tocas index.html, sube VERSION. Si no, los móviles que ya la tengan
   instalada seguirán abriendo la versión vieja. */

const VERSION = "deka-v5";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "manifest-marchena.webmanifest","manifest-iker.webmanifest","manifest-angel.webmanifest",
  "manifest-lydia.webmanifest","manifest-miguelpadre.webmanifest","manifest-joaquina.webmanifest",
  "manifest-leyre.webmanifest",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "planes/angel.json",
  "planes/iker.json",
  "planes/marchena.json",
  "planes/lydia.json",
  "planes/miguelpadre.json",
  "planes/joaquina.json",
  "planes/leyre.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      /* allSettled y no all: si mañana falta un plan de la lista, la instalación
         no se cae entera por eso */
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nada de fuera se toca

  /* 2 · planes: red primero */
  if (url.pathname.endsWith(".json")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || new Response(
          JSON.stringify({ error: "sin conexión" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )))
    );
    return;
  }

  /* 1 · la pantalla: caché primero, y se refresca por detrás */
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(VERSION).then((c) =>
        c.match("index.html", { ignoreSearch: true }).then((hit) => {
          const red = fetch(req).then((res) => {
            if (res && res.ok) c.put("index.html", res.clone());
            return res;
          }).catch(() => hit);
          return hit || red;
        })
      )
    );
    return;
  }

  /* 3 · lo demás de casa: caché primero */
  e.respondWith(
    caches.open(VERSION).then((c) =>
      c.match(req, { ignoreSearch: true }).then((hit) => {
        const red = fetch(req).then((res) => {
          if (res && res.ok) c.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || red;
      })
    )
  );
});
