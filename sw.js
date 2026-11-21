/* Hybrid Train — service worker.
   Objetivo: que la app abra al instante y siga funcionando en un box sin
   cobertura. No guarda tus datos (eso es localStorage, dentro de la app):
   guarda los ARCHIVOS con los que la app se dibuja.

   Tres políticas distintas, porque no todo se comporta igual:

   1. La pantalla (index.html) va de caché primero y se refresca por detrás.
      Se compara ignorando la query, así que ?plan=angel entra por la misma
      puerta que la raíz.
   2. Los planes (planes/*.json) van de red primero, pero con un límite de
      3 segundos (B4): con mala cobertura se sirve la copia guardada y la red
      sigue actualizándola por detrás. Antes se quedaba esperando a la red.
   3. Iconos y manifest, de caché.

   Si tocas index.html, sube VERSION. Si no, los móviles que ya la tengan
   instalada seguirán abriendo la versión vieja. */

const VERSION = "deka-v9";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "manifest-marchena.webmanifest","manifest-iker.webmanifest","manifest-angel.webmanifest",
  "manifest-lydia.webmanifest","manifest-miguelpadre.webmanifest","manifest-joaquina.webmanifest",
  "manifest-leyre.webmanifest","manifest-elena.webmanifest",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "planes/bilbao.json",
  "planes/angel.json",
  "planes/iker.json",
  "planes/marchena.json",
  "planes/lydia.json",
  "planes/miguelpadre.json",
  "planes/joaquina.json",
  "planes/leyre.json",
  "planes/elena.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      /* C13 · cache:"reload" para no precachear la copia vieja que tenga el
         navegador. allSettled y no all: si falta un plan de la lista, la
         instalación no se cae entera por eso. */
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });

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

  /* 2 · planes: red primero, pero sin esperar más de 3 s si hay copia */
  if (url.pathname.endsWith(".json")) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const red = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
      const guardada = await cache.match(req, { ignoreSearch: true });
      if (!guardada) {
        try { return await red; }
        catch (err) {
          return new Response(JSON.stringify({ error: "sin conexión" }),
            { status: 503, headers: { "Content-Type": "application/json" } });
        }
      }
      const tope = new Promise((ok) => setTimeout(() => ok(guardada), 3000));
      e.waitUntil(red.catch(() => {}));            // que la red termine de actualizar la caché
      return Promise.race([red.then((r) => (r && r.ok ? r : guardada)).catch(() => guardada), tope]);
    })());
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
