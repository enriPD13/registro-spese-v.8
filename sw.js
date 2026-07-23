/* Registro Spese v8 — service worker
   Strategia: app shell in cache (network-first sui file dell'app per avere
   sempre l'ultima versione), chiamate API sempre in rete. */
const CACHE = "registro-spese-v8.5.0";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./js/state.js",
  "./js/calc.js",
  "./js/drive.js",
  "./js/charts.js",
  "./js/calendar.js",
  "./js/forecast.js",
  "./js/render.js",
  "./js/forms.js",
  "./js/scan.js",
  "./js/backup.js",
  "./js/ui.js",
  "./js/events.js",
  "./js/app.js",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Domini che non devono MAI passare dalla cache */
const LIVE_HOSTS = ["groq.com", "anthropic.com", "googleapis.com", "accounts.google.com"];

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (LIVE_HOSTS.some((h) => url.hostname.includes(h))) return;
  if (e.request.method !== "GET") return;

  const isAppFile = url.origin === self.location.origin;

  if (isAppFile) {
    /* network-first: prende sempre la versione più fresca se c'è rete,
       con fallback alla cache quando si è offline */
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
    );
  } else {
    /* cache-first per le librerie esterne */
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }))
    );
  }
});
