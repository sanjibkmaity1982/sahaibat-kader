// SahAIbat Kader - Service Worker
const CACHE_VERSION = 'v3'; // bump this on every future deploy to force-clear old caches
const CACHE_NAME = `sahaibat-kader-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Only ever intervene for these file types - never HTML, never JS/CSS bundles,
// never API/auth calls, never Next.js data/RSC requests
const STATIC_EXTENSIONS = /\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Anything that isn't a plain GET for a known static file type goes
  // straight to network, untouched — identical to the old passthrough
  // behavior. This covers HTML pages, login/auth calls, API routes,
  // and Next.js's own internal data/RSC fetches.
  if (request.method !== 'GET' || !STATIC_EXTENSIONS.test(new URL(request.url).pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
