const CACHE_NAME = 'proton-admin-v1';

// Minimal service worker to pass PWA installability requirements
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests normally to ensure admin code is always fresh.
  // The Firebase SDK handles its own offline persistence for database reads/writes.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
