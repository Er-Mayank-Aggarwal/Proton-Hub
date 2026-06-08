const CACHE_NAME = 'proton-hub-v1';

// Minimal service worker for the public site (excludes /admin/ which has its own SW)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Skip admin routes and non-GET requests
  if (event.request.url.includes('/admin/') || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // The background fetch that updates the cache
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Open the cache and store the new network response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => {
        // If network fails, just ignore it (we already have/returned the cache)
      });

      // Return the cached response immediately if we have it, 
      // otherwise wait for the network fetch to finish
      return cachedResponse || fetchPromise;
    })
  );
});
