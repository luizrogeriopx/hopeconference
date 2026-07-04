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

// Evento de Push - recebe a notificação e a exibe no dispositivo
self.addEventListener("push", (e) => {
  let data = {};
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: "Hope Conference 2026", body: e.data.text() };
    }
  }

  const title = data.title || "Hope Conference 2026";
  const options = {
    body: data.body || "Você tem uma nova notificação.",
    icon: data.icon || "/icon-192.jpg",
    badge: data.badge || "/favicon.ico",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/painel"
    }
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Evento de Clique na Notificação - abre ou foca a janela do aplicativo
self.addEventListener("notificationclick", (e) => {
  // Fecha o balão da notificação
  e.notification.close();

  // Define a URL de destino (pode vir nos metadados ou padrão para /painel)
  const relativeUrl = e.notification.data?.url || "/painel";
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 1. Se já existir uma aba aberta na mesma URL, apenas foca nela
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      // 2. Se houver alguma aba do app aberta em outra URL, redireciona e foca nela
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // 3. Se o app não estiver aberto, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

