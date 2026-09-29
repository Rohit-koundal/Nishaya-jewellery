import { samiraApi } from '../store/apiSlice';
import { store } from '../store/store';
import { startMobileLoader, stopMobileLoader } from '../utils/mobileLoader';
import { getApiBaseUrl } from '../store/apiBaseUrl';

function customerSafeMessage(message, status, path = '', code = '') {
  if (code.startsWith('BACKGROUND_') && message) return message;
  if (path.includes('/auth/')) {
    const otpMessages = {
      OTP_PROVIDER_AUTH_FAILED: 'SMS login is unavailable because the SMS provider rejected the store credentials. Please contact support.',
      OTP_PROVIDER_NOT_CONFIGURED: 'SMS login has not been configured for this account. Please contact support.',
      OTP_DELIVERY_UNAVAILABLE: 'We could not send your OTP. Please try again shortly or contact support if this continues.',
    };
    if (Object.prototype.hasOwnProperty.call(otpMessages, code)) return otpMessages[code];
  }
  if (code.startsWith('SHIPPING_') && message) return message;
  if (code === 'PERSISTENT_UPLOAD_STORAGE_REQUIRED') {
    return path.includes('/videos') || path.includes('reel')
      ? 'Reel videos need Cloudflare R2 or Cloudinary. Local disk storage is not enough for AI processing.'
      : 'Image storage is not configured for production uploads yet. Please connect Cloudinary or R2, then upload again.';
  }
  const text = String(message || '').toLowerCase();
  if (status === 401 || status === 403 || status === 400) {
    if (message) return message;
    if (path.includes('/admin/login')) return 'Invalid admin email or password.';
    if (path.includes('/auth/')) return 'Please check the details and try again.';
  }
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
    return path.includes('/auth/')
      ? 'Unable to reach the login service. Please try again.'
      : 'Unable to reach the store right now. Please try again.';
  }
  if (status === 503 || text.includes('database unavailable') || text.includes('mongodb') || text.includes('mongo_uri') || text.includes('atlas')) {
    if (path.includes('/auth/')) return 'Login service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/coupons')) return 'Coupon service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/orders') || path.includes('/payments')) return 'Checkout service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/uploads')) return 'Image upload service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/admin/')) return 'Admin data service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/products') || path.includes('/categories') || path.includes('/banners') || path.includes('/settings')) return 'Store data service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/user/addresses')) return 'Address service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/wishlist') || path.includes('/cart')) return 'Shopping service is temporarily unavailable. Please try again in a few minutes.';
    return 'Service is temporarily unavailable. Please try again in a few minutes.';
  }
  if (status >= 500 || text.includes('server error') || text.includes('internal')) {
    return 'Something went wrong on our side. Please try again shortly.';
  }
  if (!message) return 'Something went wrong. Please try again.';
  return message;
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  const endpoint = method === 'GET' ? samiraApi.endpoints.request : samiraApi.endpoints.mutate;
  const action = method === 'GET'
    ? endpoint.initiate({ path, silent: options.silent, ...(options.cacheFirst ? { silentWhenCached: true } : {}), ...(options.cache ? { cache: options.cache } : {}), ...(options.cacheScope !== undefined ? { cacheScope: options.cacheScope } : {}) }, {
      forceRefetch: options.forceRefetch !== undefined ? options.forceRefetch : !options.cacheFirst,
      subscribe: false,
    })
    : endpoint.initiate({ path, method, body, ...(options.silent ? { silent: true } : {}) });
  const promise = store.dispatch(action);
  const abort = () => promise.abort?.();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    const result = await promise.unwrap();
    return result;
  } catch (error) {
    throw toCustomerError(error, path);
  } finally {
    options.signal?.removeEventListener('abort', abort);
    if (method === 'GET') promise?.unsubscribe?.();
  }
}

async function download(path, body) {
  startMobileLoader();
  try {
    const token = store.getState().auth.token || localStorage.getItem('samira_token');
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { data = { message: 'Unable to download the generated project.' }; }
      throw toCustomerError({ status: response.status, data }, path);
    }
    return response.blob();
  } catch (error) {
    if (error?.status) throw error;
    throw toCustomerError({ status: 'FETCH_ERROR', message: error?.message }, path, 'Unable to download the generated project.');
  } finally { stopMobileLoader(); }
}

const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, body) => request(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
  download,
  upload: async (path, files, { fieldName = 'images', onRequest, silent = false } = {}) => {
    if (!silent) startMobileLoader();
    try {
      const request = store.dispatch(samiraApi.endpoints.upload.initiate({ path, files, fieldName, silent }));
      onRequest?.({ cancel: () => request.abort() });
      return await request.unwrap();
    } catch (error) {
      throw toCustomerError(error, path, 'Upload failed');
    } finally {
      if (!silent) stopMobileLoader();
    }
  },
};

function toCustomerError(error, path, fallbackMessage) {
  const status = error?.status || error?.originalStatus || 500;
  const data = error?.data || {};
  const message = data.message || error?.message || fallbackMessage;
  const customerError = new Error(customerSafeMessage(message, status, path, data.code));
  customerError.status = status;
  customerError.code = data.code;
  customerError.details = message;
  const supportReference = data.supportReference || data.details?.supportReference;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(supportReference || ''))) customerError.supportReference = supportReference;
  if (typeof data.retryAfter === 'number' && Number.isFinite(data.retryAfter) && data.retryAfter >= 0 && data.retryAfter <= 86400) customerError.retryAfter = data.retryAfter;
  return customerError;
}

export default api;
