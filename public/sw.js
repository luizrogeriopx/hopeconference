const CACHE_NAME = "hopeconf-v1";
const ASSETS_TO_CACHE = [
  "/painel",
  "/gate",
  "/admin",
  "/super",
  "/manifest.json",
  "/icon-192.jpg",
  "/icon-512.jpg",
  "/favicon.ico"
];

// Install event - cache critical assets
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - clear old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first, fallback to cache
self.addEventListener("fetch", (e) => {
  // Only handle GET requests and local requests
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Bypass caching for Supabase Auth and API calls to prevent stale auth/realtime states
  if (e.request.url.includes("/api/") || e.request.url.includes("supabase.co")) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If response is valid, cache it
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is unavailable
        return caches.match(e.request);
      })
  );
});
