import api from '../services/api';
import { getOrCreateSessionId, readAttribution } from './attribution';
import { isWebsitePreview } from '../config/websiteDesigner';

export function trackEvent(name, extra = {}) {
  if (isWebsitePreview()) return;
  const attribution = readAttribution();
  const payload = {
    name,
    sessionId: getOrCreateSessionId(),
    path: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` || '/' : '',
    ...attribution,
    ...extra,
  };
  delete payload.razorpay_signature;
  delete payload.razorpay_payment_id;
  delete payload.razorpay_order_id;
  delete payload.token;
  delete payload.password;
  // Analytics must never open the customer-facing loader. Home section and
  // scroll events are background telemetry and can fire several times while
  // the customer browses an already-loaded page.
  api.post('/analytics/events', payload, { silent: true }).catch(() => null);
}
