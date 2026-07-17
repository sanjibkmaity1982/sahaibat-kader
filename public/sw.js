// SahAIbat Kader - Service Worker
const CACHE_NAME = 'sahaibat-kader-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Passthrough fetch - required for PWA/Play Store
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
