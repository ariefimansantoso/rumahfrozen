const CACHE_VERSION = "marketify-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CORE_ASSETS = ["/manifest.webmanifest", "/pwa/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("marketify-pwa-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableSameOriginGet(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/_next/")) return false;
  if (url.pathname === "/sw.js") return false;

  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isCacheableSameOriginGet(request)) return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return (
            cached ||
            new Response("You are offline. Please reconnect and try again.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/pwa/") ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

function parsePushPayload(event) {
  if (!event.data) return {};

  try {
    return event.data.json();
  } catch {
    return {
      title: "Notification",
      body: event.data.text(),
    };
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = payload.title || "Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa/icon.svg",
    badge: payload.badge || "/pwa/badge.svg",
    tag: payload.tag || payload.notificationId || undefined,
    renotify: Boolean(payload.tag || payload.notificationId),
    data: {
      url: payload.url || "/",
      notificationId: payload.notificationId,
    },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

async function markNotificationRead(notificationId) {
  if (!notificationId) return;

  try {
    await fetch("/api/notifications", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [notificationId], action: "read" }),
    });
  } catch {
    // Best effort only; the app will reconcile state when it opens.
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin);
  const notificationId = event.notification.data?.notificationId;

  event.waitUntil(
    (async () => {
      await markNotificationRead(notificationId);
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === targetUrl.origin && "focus" in client) {
          if ("navigate" in client) await client.navigate(targetUrl.href);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl.href);
      }
    })(),
  );
});
