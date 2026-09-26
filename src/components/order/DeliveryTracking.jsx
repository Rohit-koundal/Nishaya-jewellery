import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Truck } from 'lucide-react';
import api from '../../services/api';

export default function DeliveryTracking({ orderId, returnId, replacement = false, onUpdate }) {
  const base = returnId ? `/returns/${returnId}/${replacement ? 'replacement-delivery' : 'delivery'}` : `/orders/${orderId}/delivery`;
  const [shipment, setShipment] = useState(null);
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const updateRef = useRef(onUpdate); updateRef.current = onUpdate;
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`${base}?refresh=1`, { silent: true, cache: 'no-store' }).then(data => {
      if (!active) return;
      setShipment(data.shipment); setWarning(data.warning || ''); updateRef.current?.(data);
    }).catch(e => { if (active) setWarning(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, reload]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') setReload(n => n + 1); }, 60000); return () => clearInterval(timer); }, []);
  const status = String(shipment?.status || 'WAITING').replaceAll('_', ' ').toLowerCase();
  const carrier = ({ bluedart: 'Blue Dart', shiprocket: 'Shiprocket', delhivery: 'Delhivery', xpressbees: 'Xpressbees', manual: 'Courier' })[shipment?.provider] || shipment?.courierName || 'Courier';
  return <div className="sc-order-shipment" aria-label={returnId ? (replacement ? 'Replacement delivery tracking' : 'Return delivery tracking') : 'Courier delivery tracking'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><strong className="flex items-center gap-2"><Truck size={17} />{returnId ? `${carrier} ${replacement ? 'replacement delivery' : 'reverse pickup'}` : `${carrier} delivery`}</strong><button className="sc-orders__text" disabled={loading} onClick={() => setReload(n => n + 1)}><RefreshCw size={14} />{loading ? 'Checking...' : 'Refresh'}</button></div>
    {shipment && <><p className="capitalize"><strong>{status}</strong></p>{shipment.awb && <p>AWB: {shipment.awb}</p>}{shipment.providerStatus && <p>{shipment.providerStatus}</p>}{shipment.environment === 'sandbox' && <p>Test shipment · no real delivery</p>}{shipment.expectedDeliveryAt && !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(shipment.status) && <p>Estimated delivery: {new Date(shipment.expectedDeliveryAt).toLocaleDateString('en-IN')}</p>}{shipment.lastSyncedAt && <p className="sc-orders__muted">Last checked {new Date(shipment.lastSyncedAt).toLocaleString('en-IN')}</p>}</>}
    {warning && <p role="status" className="sc-orders__muted">{warning}</p>}
    {!shipment && !loading && !warning && <p>Pickup updates will appear once the shipment is booked.</p>}
    {shipment?.events?.length > 0 && <details><summary>Delivery updates</summary><ol>{[...shipment.events].reverse().map((event, i) => <li key={i}><strong>{String(event.status).replaceAll('_', ' ')}</strong><p>{event.note}</p><time>{new Date(event.date).toLocaleString('en-IN')}</time></li>)}</ol></details>}
  </div>;
}
