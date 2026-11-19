const CACHE_NAME = "galinyx-os-shell-v12";
const SHELL_FILES = ["./", "./index.html", "./studio-ai.js", "./galileo-avatar.js", "./xena-avatar.js", "./galileo-avatar-video.js", "./galileo-chat.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("galinyx-os-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
        }
        return response;
      }).catch(async () => (await caches.match("./index.html")) || Response.error())
    );
    return;
  }

  // The Core snapshot is republished whenever the registry, staging, or audit
  // log changes. Always try the network first so the Workforce view and the
  // Core screen show the latest published snapshot; fall back to the cached
  // copy only when offline. (Cache-first here would freeze the snapshot at
  // the first load, since this worker never re-fetches a cache hit.)
  if (request.url.endsWith('core-snapshot.json')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});