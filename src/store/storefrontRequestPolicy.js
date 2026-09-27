export const STOREFRONT_READ_TIMEOUT_MS = 15000;

// Browsing reads must not own the global action overlay. Payment, OTP, cart
// mutations, uploads and admin requests retain their existing behaviour.
export function isStorefrontRead(args) {
  const method = String(typeof args === 'string' ? 'GET' : args?.method || 'GET').toUpperCase();
  if (method !== 'GET') return false;
  const path = String(typeof args === 'string' ? args : args?.url || '').split('?')[0];
  return /^\/(?:storefront\/home|website-config|catalog-configuration|products|categories|banners|settings|reviews|variant-groups)(?:\/|$)/.test(path)
    || /^\/(?:auth\/me|cart|wishlist|notifications\/summary)$/.test(path)
    || /^\/stores\/(?!me(?:\/|$))[^/]+$/.test(path);
}
