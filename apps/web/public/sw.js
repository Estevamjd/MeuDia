const CACHE_NAME = 'meudia-v8';
const STATIC_ASSETS = [
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/apple-touch-icon.png', '/favicon.png',
];

// Pure policy, also exercised directly by Vitest. Fail closed for credentials:
// Cookie/Set-Cookie may be hidden by the browser, so only anonymous requests qualify.
// Manifests change per APP_MODE, so they stay network-only (never cached).
function shouldCache(request, origin, response) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== origin ||
      request.mode === 'navigate' || request.destination === 'document' ||
      request.credentials !== 'omit' ||
      request.headers.has('authorization') || request.headers.has('cookie')) return false;

  const path = url.pathname;
  const staticPath = path.startsWith('/_next/static/') ||
    /^\/(?:icons|fonts|images)\/[^.][^?]*\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(path) ||
    /^\/(?:apple-touch-icon|favicon(?:-\d+x\d+)?)\.(?:png|ico)$/.test(path);
  if (!staticPath) return false;
  if (!response) return true;
  const type = (response.headers.get('content-type') || '').split(';')[0].trim();
  return response.status === 200 && response.type !== 'opaque' && !response.redirected &&
    !response.headers.has('set-cookie') && !response.headers.has('authorization') &&
    !/\b(?:private|no-store|no-cache)\b/i.test(response.headers.get('cache-control') || '') &&
    !/cookie|authorization|\*/i.test(response.headers.get('vary') || '') &&
    /^(?:text\/css|(?:text|application)\/javascript|application\/(?:x-javascript|font-woff)|font\/[\w.+-]+|image\/[\w.+-]+)$/.test(type);
}

// Pre-cache anonymous public icons only; never pages or login HTML.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Failed icon downloads must not prevent activation and removal of old HTML caches.
    await Promise.allSettled(STATIC_ASSETS.map(async (path) => {
      const request = new Request(new URL(path, self.location.origin), { credentials: 'omit' });
      const response = await fetch(request);
      if (shouldCache(request, self.location.origin, response)) await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Message listener — allows the app to force-update or clear cache on logout
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    );
  }
});

// Push — lembrete de conta: { title, body, url, tag }
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'MeuDia', {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/financas' },
    })
  );
});

// Clique na notificação — usa a URL do payload (sem reconstruir); só caminhos do próprio app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/financas';
  const target = new URL(raw, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/financas';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.focus().then((focused) => (focused && 'navigate' in focused ? focused.navigate(url) : focused));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Everything outside the public static allowlist uses the network only.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldCache(request, self.location.origin)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached && shouldCache(request, self.location.origin, cached)) return cached;
    const response = await fetch(request);
    if (shouldCache(request, self.location.origin, response)) {
      // Keep the worker alive until the write completes, without failing the fetch on quota errors.
      event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
    }
    return response;
  })());
});
