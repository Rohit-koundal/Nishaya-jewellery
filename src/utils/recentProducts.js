const PREFIX = 'samira_recent_products_v1';

function key(storeSlug = '') {
  return `${PREFIX}:${String(storeSlug || 'default').trim().toLowerCase()}`;
}

export function getRecentProductIds(storeSlug = '', limit = 12) {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key(storeSlug)) || '[]');
    return [...new Set((Array.isArray(parsed) ? parsed : []).map((item) => String(item?.id || item || '')).filter(Boolean))].slice(0, limit);
  } catch {
    return [];
  }
}

export function rememberRecentProduct(productId, storeSlug = '') {
  if (typeof window === 'undefined' || !productId) return;
  try {
    const id = String(productId);
    const current = getRecentProductIds(storeSlug, 20).filter((value) => value !== id);
    localStorage.setItem(key(storeSlug), JSON.stringify([{ id, viewedAt: new Date().toISOString() }, ...current.map((value) => ({ id: value }))].slice(0, 12)));
  } catch {
    // Browsing still works when storage is unavailable.
  }
}
