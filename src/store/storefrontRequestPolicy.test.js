import { isStorefrontRead } from './storefrontRequestPolicy';

test.each(['/storefront/home?store=one', '/products/item', '/categories', '/banners', '/settings', '/website-config', '/catalog-configuration', '/stores/resolve?host=example.com', '/stores/boutique', '/auth/me', '/cart', '/wishlist', '/notifications/summary'])('%s is a non-blocking read', url => {
  expect(isStorefrontRead(url)).toBe(true);
  expect(isStorefrontRead({ url, method: 'GET' })).toBe(true);
});
test.each(['/admin/products', '/seller/reports', '/stores/me', '/stores/me/current', '/system/license', '/orders', '/auth/refresh'])('%s keeps its existing request policy', url => {
  expect(isStorefrontRead(url)).toBe(false);
});
test.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s is never treated as a browsing read', method => {
  expect(isStorefrontRead({ url: '/cart', method })).toBe(false);
  expect(isStorefrontRead({ url: '/products', method })).toBe(false);
});
