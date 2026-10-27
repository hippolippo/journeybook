/* Journeybook app-shell cache. Data is cached separately in localStorage; API
 * responses and protected media are never stored here. */
const CACHE = 'journeybook-shell-v1';
const scope = self.registration.scope;
const scopeUrl = new URL(scope);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(scope))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('journeybook-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheable(request, url) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  const basePath = scopeUrl.pathname.replace(/\/$/, '');
  if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) return false;
  if (url.pathname.includes('/api/') || url.pathname.includes('/_/')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!isCacheable(event.request, url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(event.request)) ||
            (await caches.match(scope)) ||
            (await caches.match(new URL('index.html', scope).href)) ||
            Response.error()
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
