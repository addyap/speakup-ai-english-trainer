// SpeakUp service worker — enables install + an offline app shell.
// Deliberately conservative so it can never serve stale UI or cache live data:
//   • navigations  → network-first (always try the network; fall back to the
//                    cached shell only when offline) → no stale-page-after-deploy
//   • /api/*       → never touched (live AI/data always hits the network)
//   • /assets/*    → cache-first (Vite fingerprints these, so they're immutable)
//   • other static → stale-while-revalidate
const CACHE = "speakup-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never intercept API traffic — the AI endpoints must always be live.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, offline fallback to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || Response.error())),
    );
    return;
  }

  // Fingerprinted assets: cache-first (immutable).
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // Everything else same-origin: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
