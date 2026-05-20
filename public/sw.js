// LUCA Service Worker
// Strategy: cache-first for immutable static assets, network-first for pages

const STATIC_CACHE = "luca-static-v1";
const PAGE_CACHE = "luca-pages-v1";

// /_next/static/ assets have content hashes in filenames — safe to cache forever
const IMMUTABLE_PATTERN = /\/_next\/static\//;
// App page routes for offline fallback
const APP_PATTERN = /\/(en|ru)\/app\//;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(["/icon.svg", "/manifest.json"])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Immutable Next.js chunks — cache-first, never expire
  if (IMMUTABLE_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // App page navigation — network-first with cached fallback (offline support)
  if (request.mode === "navigate" && APP_PATTERN.test(url.pathname)) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Static public assets (icons, fonts, SVGs) — cache-first
  if (
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/manifest") ||
    url.pathname.match(/\.(svg|png|ico|woff2?)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else (API, etc.) — let browser handle with its own HTTP cache
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Generic offline fallback
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LUCA — Offline</title><style>body{background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px}p{color:#888;font-size:14px}</style></head><body><svg width="48" height="48" viewBox="0 0 512 512"><rect width="512" height="512" rx="108" fill="#1a1a1a"/><path d="M144 108h52v248h172v48H144z" fill="#fff"/></svg><p>Нет подключения к сети</p></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
