'use strict';
// Keeps the site's own files on the device. Network first (always the latest version when online);
// the saved copy is used only when there is no connection. The API is never cached.
const CACHE = 'pm-site-v1';
const SHELL = ['./', 'index.html', 'app.js', 'calc.js', 'scratch.js', 'content.js', 'style.css', 'brand/shield.png', 'brand/shield-white.png', 'brand/favicon.png', 'brand/logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) c.put(req.mode === 'navigate' ? './' : req, res.clone());
      return res;
    } catch (err) {
      const hit = await c.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
