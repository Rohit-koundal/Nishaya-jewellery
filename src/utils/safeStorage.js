// Storage can be unavailable in restricted browsers. Persistence is optional;
// it must never prevent the storefront or an in-memory session from working.
export function readLocal(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writeLocal(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function removeLocal(key) {
  try { localStorage.removeItem(key); } catch { /* Storage is unavailable. */ }
}
