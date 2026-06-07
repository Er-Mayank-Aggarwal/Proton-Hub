const CACHE_NAME = 'proton-hub-v1';

// Minimal service worker for the public site (excludes /admin/ which has its own SW)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Skip admin routes — they have their own service worker
  if (event.request.url.includes('/admin/')) return;

  // Network-first strategy: always try network, fall back to cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
