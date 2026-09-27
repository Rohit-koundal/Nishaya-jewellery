import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Phone, RefreshCw, Truck } from 'lucide-react';
import api from '../../services/api';
import { safeTrackingUrl } from '../../utils/orderPresentation';

export default function DeliveryTracking({ orderId, returnId, replacement = false, initialShipment = null, onUpdate }) {
  const integrated = initialShipment?.provider && initialShipment.provider !== 'manual';
  const base = returnId ? `/returns/${returnId}/${replacement ? 'replacement-delivery' : 'delivery'}` : `/orders/${orderId}/${integrated ? 'delivery' : 'tracking'}`;
  const [shipment, setShipment] = useState(initialShipment);
  const [warning, setWarning] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const updateRef = useRef(onUpdate); updateRef.current = onUpdate;
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`${base}?refresh=1`, { silent: true, cache: 'no-store' }).then(data => {
      if (!active) return;
      if (Object.prototype.hasOwnProperty.call(data, 'shipment')) setShipment(data.shipment);
      setWarning(data.warning || ''); updateRef.current?.(data);
    }).catch(e => { if (active) setWarning(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, reload]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setReload(n => n + 1); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const self = shipment?.deliveryMode === 'SELF';
  const manual = !shipment?.provider || shipment.provider === 'manual';
  const status = String(shipment?.status || 'WAITING').replaceAll('_', ' ').toLowerCase();
  const carrier = self ? 'Store' : shipment?.courierName || ({ bluedart: 'Blue Dart', shiprocket: 'Shiprocket', delhivery: 'Delhivery', xpressbees: 'Xpressbees' })[shipment?.provider] || 'Courier';
  const tracking = shipment?.trackingNumber || shipment?.awb;
  const link = safeTrackingUrl(shipment?.trackingUrl);
  const phone = shipment?.deliveryContact?.phone;
  const updatedAt = manual ? shipment?.manualUpdatedAt : shipment?.lastSyncedAt;
  const copy = async () => {
    try { await navigator.clipboard.writeText(tracking); setCopied(true); }
    catch { setWarning('Copy is unavailable. Please select and copy the tracking number.'); }
  };
  return <div className="sc-order-shipment" aria-label={returnId ? (replacement ? 'Replacement delivery tracking' : 'Return delivery tracking') : 'Delivery tracking'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><strong className="flex items-center gap-2"><Truck size={17} />{returnId ? `${carrier} ${replacement ? 'replacement delivery' : 'reverse pickup'}` : `${carrier} delivery`}</strong><button className="sc-orders__text" disabled={loading} onClick={() => setReload(n => n + 1)}><RefreshCw size={14} />{loading ? 'Checking...' : 'Refresh tracking'}</button></div>
    {shipment && <>
      <p className="capitalize"><strong>{status}</strong></p>
      {self ? <p>Your parcel is being delivered directly by the store. Updates are added by the store; live location is not available.</p> : tracking && <p>Tracking ID: <strong>{tracking}</strong> <button className="sc-orders__text" onClick={copy} aria-label="Copy tracking number"><Copy size={14} />{copied ? 'Copied' : 'Copy'}</button></p>}
      {!self && link && <a href={link} target="_blank" rel="noopener noreferrer" className="sc-orders__text">Track with courier <ExternalLink size={14} /></a>}
      {manual && !self && <p className="sc-orders__muted">Updates here are provided by the store. For the latest courier scan, use the tracking link above when available.</p>}
      {shipment.deliveryContact?.name && <p>Delivery contact: {shipment.deliveryContact.name}</p>}
      {/^[6-9]\d{9}$/.test(phone || '') && <a className="sc-orders__text" href={`tel:+91${phone}`}><Phone size={14} />Call delivery contact</a>}
      {shipment.providerStatus && <p>{shipment.providerStatus}</p>}
      {shipment.environment === 'sandbox' && <p>Test shipment · no real delivery</p>}
      {shipment.expectedDeliveryAt && !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(shipment.status) && <p>Estimated delivery: {new Date(shipment.expectedDeliveryAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>}
      {updatedAt && <p className="sc-orders__muted">Last updated {new Date(updatedAt).toLocaleString('en-IN')}</p>}
    </>}
    {warning && <p role="status" className="sc-orders__muted">{warning}</p>}
    {!shipment && !loading && !warning && <p>Delivery details will appear once the store arranges dispatch.</p>}
    {shipment?.events?.length > 0 && <details><summary>Delivery updates</summary><ol>{[...shipment.events].reverse().map((event, i) => <li key={i}><strong>{String(event.status).replaceAll('_', ' ')}</strong><p>{event.note}</p><time>{new Date(event.date).toLocaleString('en-IN')}</time></li>)}</ol></details>}
  </div>;
}
