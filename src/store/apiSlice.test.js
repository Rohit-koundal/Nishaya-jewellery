import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import authReducer, { logout, setCredentials } from './authSlice';
import { samiraApi } from './apiSlice';
import { startMobileLoader } from '../utils/mobileLoader';

test('Smart Fill suggestions do not refetch catalog subscriptions or block the mobile screen', async () => {
  mockRawQuery.mockResolvedValue({ data: [] });
  const catalog = testStore.dispatch(samiraApi.endpoints.request.initiate({ path: '/admin/products' }));
  await catalog.unwrap(); jest.clearAllMocks();
  await testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/admin/products/smart-fill', body: { notes: 'Saree' }, silent: true })).unwrap();
  expect(mockRawQuery).toHaveBeenCalledTimes(1);
  expect(mockRawQuery.mock.calls[0][0].url).toBe('/admin/products/smart-fill');
  expect(startMobileLoader).not.toHaveBeenCalled(); catalog.unsubscribe();
});

const mockRawQuery = jest.fn();
let mockBaseOptions;
// CRA's Jest resolver predates conditional package exports; use the package's
// CommonJS build while exercising the actual Redux Query implementation.
jest.mock('@standard-schema/utils', () => jest.requireActual('../../node_modules/@standard-schema/utils/dist/index.cjs'));
jest.mock('@reduxjs/toolkit/query/react', () => ({
  ...jest.requireActual('@reduxjs/toolkit/query/react'),
  fetchBaseQuery: options => (...args) => { mockBaseOptions = options; return mockRawQuery(...args); },
}));
jest.mock('../utils/mobileLoader', () => ({ startMobileLoader: jest.fn(), stopMobileLoader: jest.fn() }));

const user = { _id: 'admin-one', role: 'admin', activeMode: 'admin' };
const original = { user, token: 'expired-access', refreshToken: 'valid-refresh' };
const renewed = { user, token: 'renewed-access', refreshToken: 'renewed-refresh' };
const unauthorized = { error: { status: 401, data: { message: 'Token expired' } } };
let testStore;
function request(path) {
  return testStore.dispatch(samiraApi.endpoints.request.initiate({ path }, { subscribe: false }));
}
function defer() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks();
  testStore = configureStore({
    reducer: { auth: authReducer, [samiraApi.reducerPath]: samiraApi.reducer },
    middleware: (defaults) => defaults().concat(samiraApi.middleware),
  });
  testStore.dispatch(setCredentials(original));
});
afterEach(() => testStore.dispatch(samiraApi.util.resetApiState()));

test.each(['FETCH_ERROR', 'TIMEOUT_ERROR', 503])('a %s during token refresh preserves the restored admin login', async (status) => {
  mockRawQuery.mockImplementation(async ({ url }) => url === '/auth/refresh'
    ? { error: { status, data: { message: 'Temporarily unavailable' } } }
    : unauthorized);
  const result = await request('/auth/me');
  expect(result.error.status).toBe(status);
  expect(testStore.getState().auth).toEqual({ user, token: original.token, refreshToken: null });
  expect(localStorage.getItem('samira_token')).toBe(original.token);
});

test('simultaneous expired requests share one refresh and both resume with the new token', async () => {
  const refresh = defer();
  mockRawQuery.mockImplementation(async ({ url }, context) => url === '/auth/refresh'
    ? refresh.promise
    : context.getState().auth.token === renewed.token ? { data: { path: url } } : unauthorized);
  const first = request('/auth/me'); const second = request('/notifications/summary');
  await waitFor(() => expect(mockRawQuery.mock.calls.filter(([arg]) => arg.url === '/auth/refresh')).toHaveLength(1));
  refresh.resolve({ data: renewed });
  expect((await first).data).toEqual({ path: '/auth/me' });
  expect((await second).data).toEqual({ path: '/notifications/summary' });
  expect(mockRawQuery.mock.calls.filter(([arg]) => arg.url === '/auth/refresh')).toHaveLength(1);
  expect(testStore.getState().auth).toEqual({ user, token: renewed.token, refreshToken: null });
});

test('an invalid refresh token clears the rejected session', async () => {
  mockRawQuery.mockResolvedValue(unauthorized);
  expect((await request('/auth/me')).error.status).toBe(401);
  expect(testStore.getState().auth.user).toBeNull();
  expect(localStorage.getItem('samira_refresh_token')).toBeNull();
});

test('a delayed refresh cannot sign the account back in after logout', async () => {
  const refresh = defer();
  mockRawQuery.mockImplementation(async ({ url }) => url === '/auth/refresh' ? refresh.promise : unauthorized);
  const pending = request('/auth/me');
  await waitFor(() => expect(mockRawQuery.mock.calls.some(([arg]) => arg.url === '/auth/refresh')).toBe(true));
  testStore.dispatch(logout());
  refresh.resolve({ data: renewed });
  expect((await pending).error.status).toBe(409);
  expect(testStore.getState().auth.user).toBeNull();
  expect(localStorage.getItem('samira_token')).toBeNull();
});

test('a failed request from the previous account is never replayed as another customer', async () => {
  const response = defer(); mockRawQuery.mockReturnValue(response.promise);
  const pending = testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/orders/order-one/cancel', body: {} }));
  testStore.dispatch(setCredentials({ user: { _id: 'customer-two' }, token: 'customer-two-access', refreshToken: 'customer-two-refresh' }));
  response.resolve(unauthorized);
  expect((await pending).error.status).toBe(409);
  expect(mockRawQuery).toHaveBeenCalledTimes(1);
  expect(testStore.getState().auth.user._id).toBe('customer-two');
});

test('a slow original 401 retries an already refreshed session without refreshing twice', async () => {
  const slow = defer();
  mockRawQuery.mockImplementation(async ({ url }, context) => {
    if (url === '/auth/refresh') return { data: renewed };
    if (context.getState().auth.token === renewed.token) return { data: { path: url } };
    return url === '/notifications/summary' ? slow.promise : unauthorized;
  });
  const notifications = request('/notifications/summary');
  await request('/auth/me');
  slow.resolve(unauthorized);
  expect((await notifications).data).toEqual({ path: '/notifications/summary' });
  expect(mockRawQuery.mock.calls.filter(([arg]) => arg.url === '/auth/refresh')).toHaveLength(1);
});

test('catalog caches remain separate when switching between boutiques and the main shop', async () => {
  mockRawQuery.mockImplementation(async args => ({ data: [{ id: args.params?.store || 'main' }] }));
  const read = store => testStore.dispatch(samiraApi.endpoints.getProducts.initiate({ store }, { subscribe: false }));
  expect((await read('boutique-a')).data).toEqual([{ id: 'boutique-a' }]);
  expect((await read('boutique-b')).data).toEqual([{ id: 'boutique-b' }]);
  expect((await read('')).data).toEqual([{ id: 'main' }]);
  expect((await read('boutique-a')).data).toEqual([{ id: 'boutique-a' }]);
  expect(mockRawQuery).toHaveBeenCalledTimes(3);
});

test('storefront transport options share one Redux cache entry while account scopes stay isolated', async () => {
  mockRawQuery.mockImplementation(async args => ({ data: { path: args.url } }));
  const read = (cacheScope, silent) => testStore.dispatch(samiraApi.endpoints.request.initiate(
    { path: '/cart', cacheScope, silent, silentWhenCached: true },
    { subscribe: false },
  ));

  await read('customer-one', false);
  await read('customer-one', true);
  await read('customer-two', true);

  expect(mockRawQuery).toHaveBeenCalledTimes(2);
});

test('mobile home feed uses the shared global loader and keeps store scope explicit', async () => {
  mockRawQuery.mockResolvedValue({ data: { products: [], categories: [], banners: [] } });
  await testStore.dispatch(samiraApi.endpoints.getMobileHome.initiate({ store: 'boutique-a' }, { subscribe: false }));
  expect(mockRawQuery.mock.calls[0][0]).toEqual({ url: '/storefront/home', params: { store: 'boutique-a' } });
  expect(startMobileLoader).toHaveBeenCalledTimes(1);
});

test('a cached mobile home refresh stays in Redux without reopening the blocking loader', async () => {
  mockRawQuery.mockResolvedValue({ data: { products: [], categories: [], banners: [] } });
  const subscription = testStore.dispatch(samiraApi.endpoints.getMobileHome.initiate({ store: 'boutique-a' }));
  await subscription.unwrap();
  expect(startMobileLoader).toHaveBeenCalledTimes(1);

  jest.clearAllMocks();
  testStore.dispatch(samiraApi.util.invalidateTags(['Products']));
  await waitFor(() => expect(mockRawQuery).toHaveBeenCalledTimes(1));
  expect(startMobileLoader).not.toHaveBeenCalled();
  subscription.unsubscribe();
});

test('explicit catalog scope wins over the previous tab session header, including the main shop', async () => {
  mockRawQuery.mockResolvedValue({ data: [] });
  await request('/settings');
  sessionStorage.setItem('samira_store_slug', 'previous-store');
  const prepare = store => {
    const headers = new Map();
    mockBaseOptions.prepareHeaders(headers, { getState: testStore.getState, arg: { params: { store } } });
    return headers;
  };
  expect(prepare('new-store').get('x-store-slug')).toBe('new-store');
  expect(prepare('').has('x-store-slug')).toBe(false);
});

test('product detail, categories and banners carry their own explicit store scope', async () => {
  mockRawQuery.mockResolvedValue({ data: [] });
  await testStore.dispatch(samiraApi.endpoints.getProduct.initiate({ id: 'item', store: 'boutique' }, { subscribe: false }));
  await testStore.dispatch(samiraApi.endpoints.getCategories.initiate({ store: 'boutique' }, { subscribe: false }));
  await testStore.dispatch(samiraApi.endpoints.getBanners.initiate({ store: 'boutique' }, { subscribe: false }));
  expect(mockRawQuery.mock.calls.map(([args]) => args)).toEqual([
    { url: '/products/item', params: { store: 'boutique' } },
    { url: '/categories', params: { store: 'boutique' } },
    { url: '/banners', params: { store: 'boutique' } },
  ]);
});
