import { readLocal, removeLocal, writeLocal } from './safeStorage';

export function createStoragePlan(prefix, user) {
  const userId = getUserId(user);
  const phone = normalizePhone(user?.phone);
  const scope = userId ? `user_${userId}` : phone ? `phone_${phone}` : 'guest';
  const storageName = `${prefix}_${scope}`;
  const legacyStorageNames = new Set();

  if (userId && phone) {
    legacyStorageNames.add(`${prefix}_${phone}`);
  } else if (!userId && !phone) {
    legacyStorageNames.add(prefix);
  }

  legacyStorageNames.delete(storageName);
  return {
    storageName,
    legacyStorageNames: Array.from(legacyStorageNames),
  };
}

export function readScopedJson(storageName, legacyStorageNames = [], fallbackValue) {
  const readJson = (name) => {
    const raw = readLocal(name);
    if (!raw) return undefined;
    return JSON.parse(raw);
  };

  try {
    const current = readJson(storageName);
    if (current !== undefined) return current;

    for (const legacyName of legacyStorageNames) {
      const legacyValue = readJson(legacyName);
      if (legacyValue !== undefined) {
        if (writeLocal(storageName, JSON.stringify(legacyValue))) removeLocal(legacyName);
        return legacyValue;
      }
    }
    return fallbackValue;
  } catch {
    removeLocal(storageName);
    legacyStorageNames.forEach(removeLocal);
    return fallbackValue;
  }
}

function getUserId(user = {}) {
  return user?._id || user?.id || '';
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits || '';
}
