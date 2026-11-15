/* ---- Service worker (generated: build.js injects the asset list) ----
 * Cache-first for content-hashed assets (immutable), network-first for
 * index.html/navigation so new deploys go live immediately.
 */
const CACHE = 'rwuchat-v1';
const ASSETS = /*__ASSETS__*/['./'/*__ASSETS__*/];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Hashed assets never change — serve from cache, fall back to network.
  if (/\.[0-9a-f]{8}\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req))
    );
    return;
  }

  // index.html / navigations: try the network first so deploys go live,
  // fall back to the cached copy when offline.
  const isNav = req.mode === 'navigate' || /(^|\/)index\.html$/.test(url.pathname);
  if (isNav) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./')))
    );
  }
});
