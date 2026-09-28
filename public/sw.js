const CACHE_PREFIX = 'nishaya-jewellery-phone-shell-';
const CACHE = `${CACHE_PREFIX}v5`;
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.json', '/nishaya-jewellery-logo.svg'];
const STATIC_PATTERN = /\.(?:js|css|woff2?|png|jpe?g|gif|svg|ico|webp)$/i;
const PRIVATE_PATH = /^\/(?:api|uploads|admin|seller|checkout|orders|order-detail|order-success|payment-failed|profile|returns|notifications)(?:\/|$)/;

async function openShellCache() {
  try { return await caches.open(CACHE); } catch (_) { return null; }
}

async function readCache(cache, request) {
  try { return cache ? await cache.match(request) : null; } catch (_) { return null; }
}

async function saveCache(cache, request, response) {
  try { if (cache) await cache.put(request, response.clone()); } catch (_) { /* Quota/storage failures must not break a successful network response. */ }
}

function validStatic(response, pathname) {
  if (!response || !response.ok) return false;
  const type = response.headers.get('content-type') || '';
  // SPA rewrites can return index.html for a removed chunk after deployment.
  // Never retain that HTML under a JavaScript/CSS URL.
  if (/\.js$/i.test(pathname)) return /(?:java|ecma)script/i.test(type);
  if (/\.css$/i.test(pathname)) return /text\/css/i.test(type);
  return !/text\/html/i.test(type);
}

async function cacheShell() {
  const cache = await openShellCache();
  if (!cache) return;
  await Promise.allSettled(APP_SHELL.map(async (path) => {
    const response = await fetch(path, { cache: 'reload' });
    if (response.ok) await saveCache(cache, path, response);
  }));
}

self.addEventListener('install', (event) => event.waitUntil(cacheShell()));

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    } catch (_) { /* An unavailable optional cache must not prevent activation. */ }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function navigationResponse(request) {
  const cache = await openShellCache();
  try {
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('text/html') && !PRIVATE_PATH.test(new URL(request.url).pathname)) {
      await saveCache(cache, '/index.html', response);
    }
    return response;
  } catch (_) {
    return (await readCache(cache, '/index.html')) || (await readCache(cache, '/offline.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // The tiny recovery script is unversioned and must track the current HTML.
  if (url.pathname === '/startup.js') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (!STATIC_PATTERN.test(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await openShellCache();
    const cached = await readCache(cache, request);
    if (validStatic(cached, url.pathname)) return cached;
    const response = await fetch(request);
    if (response.type === 'basic' && validStatic(response, url.pathname)) await saveCache(cache, request, response);
    return response;
  })());
});
