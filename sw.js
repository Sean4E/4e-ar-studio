// 4E AR Player — minimal service worker
// Purpose: satisfy PWA install criteria and provide a lightweight
// network-first fetch for the player shell. Data/assets are served
// from Firestore / GitHub Pages and don't need caching here.

const CACHE = '4e-ar-shell-v1';
const SHELL = ['/player-v2.html', '/config.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only handle our own origin's shell; let the browser handle everything else
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        // Cache the player shell responses opportunistically
        if (r.ok && SHELL.some(p => url.pathname.endsWith(p))) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
