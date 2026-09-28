import fs from 'fs';
import path from 'path';
import vm from 'vm';

const source = fs.readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
const origin = 'https://store.example';
let listeners, cache, cachesApi, network, worker;
function response(type = 'application/javascript', body = 'asset') {
  const value = { ok: true, type: 'basic', body, headers: { get: () => type } };
  value.clone = () => value;
  return value;
}

beforeEach(() => {
  listeners = {};
  cache = { match: jest.fn().mockResolvedValue(undefined), put: jest.fn().mockResolvedValue(undefined) };
  cachesApi = { open: jest.fn().mockResolvedValue(cache), keys: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(true) };
  network = jest.fn().mockResolvedValue(response());
  worker = {
    location: { origin }, clients: { claim: jest.fn().mockResolvedValue(undefined) }, skipWaiting: jest.fn(),
    addEventListener: (name, listener) => { listeners[name] = listener; },
  };
  vm.runInNewContext(source, { self: worker, caches: cachesApi, fetch: network, URL, Response: { error: () => ({ error: true }) } });
});

function fetchRequest(pathname, options = {}) {
  let pending;
  listeners.fetch({
    request: { url: origin + pathname, method: 'GET', mode: 'cors', ...options },
    respondWith: (promise) => { pending = promise; },
  });
  return pending;
}

test('first installation can finish even when browser cache access is blocked', async () => {
  cachesApi.open.mockRejectedValue(new Error('Storage blocked'));
  let pending;
  listeners.install({ waitUntil: value => { pending = value; } });
  await expect(pending).resolves.toBeUndefined();
  expect(network).not.toHaveBeenCalled();
});

test('activation clears only old store shell versions and claims clients', async () => {
  cachesApi.keys.mockResolvedValue(['nishaya-jewellery-phone-shell-v4', 'nishaya-jewellery-phone-shell-v5', 'unrelated-data']);
  let pending;
  listeners.activate({ waitUntil: value => { pending = value; } });
  await pending;
  expect(cachesApi.delete).toHaveBeenCalledTimes(1);
  expect(cachesApi.delete).toHaveBeenCalledWith('nishaya-jewellery-phone-shell-v4');
  expect(worker.clients.claim).toHaveBeenCalledTimes(1);
});

test('activation still succeeds if cache maintenance is denied', async () => {
  cachesApi.keys.mockRejectedValue(new Error('Storage blocked'));
  let pending;
  listeners.activate({ waitUntil: value => { pending = value; } });
  await pending;
  expect(worker.clients.claim).toHaveBeenCalledTimes(1);
});

test('a successful document response survives a quota failure', async () => {
  const page = response('text/html', '<main>Store</main>');
  network.mockResolvedValue(page);
  cache.put.mockRejectedValue(new Error('Quota exceeded'));
  expect(await fetchRequest('/', { mode: 'navigate' })).toBe(page);
});

test.each(['open', 'match', 'put'])('an asset still loads when cache %s fails', async (operation) => {
  if (operation === 'open') cachesApi.open.mockRejectedValue(new Error('Blocked'));
  else cache[operation].mockRejectedValue(new Error('Blocked'));
  const asset = response();
  network.mockResolvedValue(asset);
  expect(await fetchRequest('/static/js/main.hash.js')).toBe(asset);
});

test.each(['/static/js/old.js', '/static/css/old.css'])('HTML from a SPA rewrite is never cached as %s', async pathname => {
  network.mockResolvedValue(response('text/html', '<html>Not a chunk</html>'));
  await fetchRequest(pathname);
  expect(cache.put).not.toHaveBeenCalled();
});

test('an invalid previously cached script falls back to the network', async () => {
  cache.match.mockResolvedValue(response('text/html'));
  const asset = response();
  network.mockResolvedValue(asset);
  expect(await fetchRequest('/static/js/main.hash.js')).toBe(asset);
  expect(cache.put).toHaveBeenCalled();
});

test('valid cached chunks still work offline', async () => {
  const asset = response();
  cache.match.mockResolvedValue(asset);
  expect(await fetchRequest('/static/js/main.hash.js')).toBe(asset);
  expect(network).not.toHaveBeenCalled();
});

test('offline navigation retains its existing saved shell fallback', async () => {
  const page = response('text/html');
  network.mockRejectedValue(new Error('Offline'));
  cache.match.mockImplementation(async name => name === '/index.html' ? page : undefined);
  expect(await fetchRequest('/', { mode: 'navigate' })).toBe(page);
});

test('private page responses are not written to the public shell cache', async () => {
  network.mockResolvedValue(response('text/html'));
  await fetchRequest('/checkout', { mode: 'navigate' });
  expect(cache.put).not.toHaveBeenCalled();
});

test.each(['/api/products', '/uploads/image.jpg', '/startup.js'])('does not intercept %s', pathname => {
  expect(fetchRequest(pathname)).toBeUndefined();
  expect(network).not.toHaveBeenCalled();
});
