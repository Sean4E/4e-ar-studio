// 4E AR Player — minimal service worker
// Purpose: satisfy PWA install criteria and provide a lightweight
// network-first fetch for the player shell. Data/assets are served
// from Firestore / GitHub Pages and don't need caching here.

// Bump this version whenever the player shell materially changes so
// returning PWAs pick up the new code. The activate handler below
// nukes any cache that doesn't match the current version, and the
// no-cache headers on sw.js (firebase.json) ensure this file itself
// is re-fetched promptly instead of living for hours in the browser
// HTTP cache.
const CACHE = '4e-ar-shell-v4';
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
  // Only intercept the handful of SHELL paths we actually cache.
  // Anything else (studio, projects.html, player-spatial, spatial-v7,
  // docs/, Firebase Hosting static assets, etc.) is left to the
  // browser. Intercepting without caching caused "Failed to convert
  // value to Response" TypeErrors whenever the network fetch rejected
  // and caches.match returned undefined — ugly console noise and a
  // real availability regression on flaky networks.
  const isShell = SHELL.some(p => url.pathname.endsWith(p));
  if (!isShell) return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      // Fall back to cache on network failure. If cache also has
      // nothing, synthesise a 504 rather than returning undefined
      // (which the browser rejects with TypeError).
      .catch(() => caches.match(e.request).then(r => r || new Response('Service unavailable', { status: 504, statusText: 'Gateway Timeout' })))
  );
});
