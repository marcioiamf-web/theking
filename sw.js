// TheKing Idiomas — service worker
// Objetivo simples: guardar a app em cache para poder abrir mesmo offline
// (ou com internet fraca) e permitir "Adicionar ao ecrã principal".
// Também mostra o lembrete diário (notificação) quando o servidor o envia.

const CACHE_NAME = "theking-idiomas-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // se algum ficheiro falhar, não impede a instalação
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Nunca guardar em cache chamadas às APIs (pagamentos / liga) — têm de ser sempre em direto.
  if (req.url.includes("workers.dev")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && (req.url.startsWith(self.location.origin))) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ---- Lembrete diário (notificações) ----
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "TheKing Idiomas 👑";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Hora de estudar inglês com a Bíblia!",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: "lembrete-diario",
      data: { url: data.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "./", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
