// Service worker for the dispatch dashboard app (Nokael Dispatch PWA).
//
// - Push: shows notifications sent by the push-dispatch Edge Function and
//   opens (or focuses) the dashboard when one is tapped.
// - Offline: when a staff page (dashboard, login, onboarding) can't load
//   because there is no connection, it shows /offline.html instead of the
//   browser's error page. Every other request goes straight to the network:
//   nothing is cached, so pages and data are always live.
//
// The file keeps its name (push.ts registers it as /push-sw.js) and is served
// with Cache-Control: no-cache, so devices pick up changes on the next visit.

const OFFLINE_CACHE = 'nokael-dispatch-offline-v1';
const OFFLINE_URL = '/offline.html';
const OFFLINE_ASSETS = [OFFLINE_URL, '/icons/icon-192.png'];
const STAFF_PATHS = ['/dashboard', '/admin', '/login', '/onboarding', '/accept-invite'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('nokael-dispatch-') && k !== OFFLINE_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The offline page's own icon, from the cache when there is no network.
  if (OFFLINE_ASSETS.includes(url.pathname) && url.pathname !== OFFLINE_URL) {
    event.respondWith(fetch(req).catch(() => caches.match(url.pathname)));
    return;
  }

  if (req.mode !== 'navigate') return;
  if (!STAFF_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) return;
  event.respondWith(
    fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nokael', {
      body: data.body || '',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(target));
      if (open) return open.focus();
      // An open dashboard window (e.g. the installed app): bring it to the job.
      const app = windows.find((w) => new URL(w.url).pathname.startsWith('/dashboard'));
      if (app && 'navigate' in app) {
        await app.navigate(target).catch(() => undefined);
        return app.focus();
      }
      return self.clients.openWindow(target);
    })()
  );
});
