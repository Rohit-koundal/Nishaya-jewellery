import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import './OrderNotificationSettings.css';

const REASONS = {
  EMAIL_NOT_CONFIGURED: 'Add the Brevo backend credentials, then retry.',
  ADMIN_EMAIL_NOT_CONFIGURED: 'Save an admin notification email, then retry.',
  NO_VERIFIED_CUSTOMER_EMAIL: 'Customer has no verified email. In-app notification is still available.',
  DISABLED_IN_SETTINGS: 'This channel is disabled in saved settings.',
  ORDER_NO_LONGER_ELIGIBLE: 'Order was cancelled, refunded or is no longer eligible.',
  RECIPIENT_CHANGED_AFTER_ATTEMPT: 'Recipient changed after a send attempt. Check provider logs before contacting them again.',
  CHECK_PROVIDER_LOGS: 'Delivery is uncertain. Check this channel in the provider dashboard; automatic resend is paused to avoid duplicates.',
  PROVIDER_AUTH_OR_SENDER_REJECTED: 'Check this channel’s backend credentials, sender and account access.',
  PROVIDER_REJECTED: 'Provider rejected the request. Check sender, recipient, account access and approved template.',
  PROVIDER_RATE_LIMIT: 'Provider rate or quota limit reached. Check quota and retry when available.',
  WHATSAPP_NOT_CONFIGURED: 'Complete the Meta WhatsApp backend configuration, then retry.',
  ADMIN_WHATSAPP_NOT_CONFIGURED: 'Save a valid admin WhatsApp number, then retry.',
  NO_CUSTOMER_WHATSAPP_CONSENT: 'No checkout opt-in for this verified login number. No WhatsApp message sent.',
  WHATSAPP_DELIVERY_FAILED: 'Meta reported delivery failure. Check the error code, approved template, account and recipient before retrying.',
  TEMPORARY_DELIVERY_FAILURE: 'Temporary delivery issue. Queued alerts retry automatically; failed alerts can be retried after investigation.',
};
const LABELS = { SENT: 'Sent', DELIVERED: 'Delivered', READ: 'Read', ACCEPTED: 'Provider accepted', QUEUED: 'Queued', PROCESSING: 'Processing', BLOCKED: 'Setup needed', FAILED: 'Failed', SKIPPED: 'Skipped', UNCERTAIN: 'Check provider logs' };

export default function OrderNotificationSettings({ apiBase, revision }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState('');
  const generation = useRef(0);
  const retryLock = useRef(false);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try { const value = await api.get(`${apiBase}/order-notifications`, { silent: true }); if (current === generation.current) setData(value); }
    catch (err) { if (current === generation.current) setError(err.message || 'Unable to load delivery status.'); }
    finally { if (current === generation.current) setLoading(false); }
  }, [apiBase]);
  useEffect(() => { setData(null); load(); return () => { generation.current += 1; }; }, [load, revision]);
  const retry = async id => {
    if (retryLock.current) return;
    retryLock.current = true; setRetrying(id); setNotice(''); setError('');
    try { const result = await api.post(`${apiBase}/order-notifications/${id}/retry`, {}); setNotice(result.message); await load(); }
    catch (err) { setError(err.message || 'Unable to retry this alert.'); }
    finally { retryLock.current = false; setRetrying(''); }
  };
  return <div className="order-alerts store-settings__wide">
    <div className="order-alerts__heading"><h3>Delivery status</h3><button type="button" className="admin-btn-ghost" onClick={load} disabled={loading || !!retrying}>{loading ? 'Checking…' : 'Refresh status'}</button></div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {data && <>
      <div className="store-settings__tip"><div>
        <p><strong>In-app alerts are enabled for customers and admin.</strong> The notification bell updates while the website is open. This is not a phone push notification.</p>
        <p><strong>Email: {data.configured ? 'Credentials configured — verify delivery in Brevo' : 'Setup required'}</strong></p>
        {!!data.missing?.length && <p>Add on the backend: <code>{data.missing.join(', ')}</code>. Verify the sender in Brevo and redeploy. Never put the API key in frontend settings.</p>}
        <p>Saved admin recipient: {data.adminEmail || 'Not configured'} · Admin email {data.adminEnabled ? 'on' : 'off'} · Customer email {data.customerEnabled ? 'on' : 'off'}</p>
        <p><strong>WhatsApp: {data.whatsapp?.configured ? 'Credentials configured — verify templates and delivery in Meta' : 'Setup required'}</strong></p>
        {!!data.whatsapp?.missing?.length && <p>Add on the backend: <code>{data.whatsapp.missing.join(', ')}</code>.</p>}
        {!!data.whatsapp?.invalid?.length && <p role="alert">Check configuration format: {data.whatsapp.invalid.join(', ')}.</p>}
        <p>Admin WhatsApp {data.whatsapp?.adminEnabled ? 'on' : 'off'} · Customer WhatsApp {data.whatsapp?.customerEnabled ? 'on' : 'off'} · Admin recipient: {data.whatsapp?.adminRecipient || 'Not configured'}</p>
        <p>WhatsApp requires a Meta Business sender, approved order templates and a signed status webhook. Customer messages require checkout opt-in. Provider charges may apply. These order alerts never make calls.</p>
      </div></div>
      <p className="order-alerts__note">Save settings above before testing. New orders only; past orders are not messaged automatically. “Provider accepted” is not proof of delivery. Check Brevo logs for email delivery/bounces. WhatsApp Delivered/Read comes from Meta’s signed webhook; read receipts may be unavailable. The two channels work independently.</p>
      <h4>Latest 30 alerts</h4>
      {!data.items?.length ? <p className="order-alerts__note">No order alerts yet. Place a COD order or complete a test online payment to verify the flow.</p> : <ul className="order-alerts__list">{data.items.map(item => <li key={item._id}>
        <div><strong>Order {String(item.order).slice(-8).toUpperCase()}</strong><span>{item.channel === 'IN_APP' ? 'Customer + admin · In-app' : `${item.audience === 'ADMIN' ? 'Admin' : 'Customer'} · ${item.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}`}</span></div>
        <div><span className={`order-alerts__status order-alerts__status--${item.status.toLowerCase()}`}>{LABELS[item.status] || item.status}</span><small>{item.attempts} attempt(s) · {new Date(item.updatedAt).toLocaleString()}</small></div>
        {item.reason && <p>{REASONS[item.reason] || 'Review this alert before retrying.'}</p>}
        {item.providerErrorCode != null && <p>Provider error code: {item.providerErrorCode}</p>}
        {item.canRetry && <button type="button" className="admin-btn-ghost" disabled={!!retrying || !(item.channel === 'WHATSAPP' ? data.whatsapp?.[item.audience === 'ADMIN' ? 'adminConfigured' : 'customerConfigured'] : data.configured)} onClick={() => retry(item._id)} aria-label={`Retry ${item.audience.toLowerCase()} alert for order ${String(item.order).slice(-8)}`}>{retrying === item._id ? 'Queuing…' : 'Retry after fixing setup'}</button>}
      </li>)}</ul>}
    </>}
  </div>;
}
