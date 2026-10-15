const CACHE_NAME = "wallet-pwa-v39";
const APP_SHELL = ["./", "./index.html", "./styles.css?v=39", "./mobile-overrides.css?v=39", "./app.js?v=39", "./security.js?v=39", "./manifest.webmanifest", "./icon.svg"];
const PUBLIC_PATHS = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("wallet-pwa-") && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !PUBLIC_PATHS.has(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
