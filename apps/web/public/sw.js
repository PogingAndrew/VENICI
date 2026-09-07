// Minimal service worker: network-first, falling back to cache when
// offline. Hashed build filenames change every deploy, so this caches
// opportunistically at request time rather than precaching a fixed file
// list (which would need to be regenerated on every build otherwise).
const CACHE_NAME = "venici-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests — never intercept API calls,
  // cross-origin requests, or non-GET methods (POST/PATCH/DELETE must
  // always hit the network).
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  if (request.url.includes("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
  );
});
