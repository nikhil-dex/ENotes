const CACHE_NAME = 'enotes-shell-v1';
const SHELL_URLS = ['/notes', '/style.css', '/extra.css'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(['/style.css', '/extra.css']);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('enotes-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/access')) return;
  const isShellAsset = url.pathname === '/style.css' || url.pathname === '/extra.css' || url.pathname.startsWith('/_next/static/');
  const isNotesNavigation = request.mode === 'navigate' && (url.pathname === '/notes' || url.pathname === '/notes/');
  if (!isShellAsset && !isNotesNavigation) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request) || (isNotesNavigation ? await cache.match('/notes') : null);
      if (cached) return cached;
      return new Response('This page has not been cached on this device yet. Reconnect to open ENotes, then revisit this page to enable offline access.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  })());
});
