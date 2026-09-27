import { useEffect, useRef, useState } from 'react';
import { Truck } from 'lucide-react';
import { safeTrackingUrl } from '../../utils/orderPresentation';

const field = 'admin-field__control w-full';
const dateValue = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 10) : '';
const fromOrder = order => ({
  deliveryMode: order.shipment?.deliveryMode || 'COURIER',
  courierName: order.shipment?.courierName || '',
  trackingNumber: order.shipment?.trackingNumber || order.shipment?.awb || '',
  trackingUrl: order.shipment?.trackingUrl || '',
  expectedDeliveryAt: dateValue(order.shipment?.expectedDeliveryAt),
  deliveryContact: { name: order.shipment?.deliveryContact?.name || '', phone: order.shipment?.deliveryContact?.phone || '' },
  note: '',
});

export default function ManualDeliveryPanel({ order, busy, onSave }) {
  const [form, setForm] = useState(() => fromOrder(order));
  const [update, setUpdate] = useState({ event: 'NOTE', note: '', expectedDeliveryAt: '' });
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => { setForm(fromOrder(order)); setUpdate({ event: 'NOTE', note: '', expectedDeliveryAt: '' }); setError(''); }, [order._id, order.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const dispatched = ['Shipped', 'Out for Delivery'].includes(order.orderStatus);
  const rto = order.rto?.status && order.rto.status !== 'NONE';
  const closed = ['Delivered', 'Cancelled', 'Returned', 'Refunded'].includes(order.orderStatus) || order.shipment?.status === 'RETURNED';
  const editable = ['Confirmed', 'Packed', 'Shipped', 'Out for Delivery'].includes(order.orderStatus) && !closed && !rto;
  const self = form.deliveryMode === 'SELF';
  const set = (key, value) => { setSaved(''); setError(''); setForm(current => ({ ...current, [key]: value })); };
  const submit = async (event, body, message) => {
    event.preventDefault();
    if (busy || pending.current) return;
    setSaved(''); setError('');
    if (body.event === 'DETAILS' && body.deliveryMode === 'COURIER' && (!body.courierName.trim() || !body.trackingNumber.trim())) { setError('Enter the courier name and real AWB / tracking number.'); return; }
    if (body.event !== 'DETAILS' && body.note.trim().length < 3) { setError('Enter a delivery update of at least 3 characters.'); return; }
    if (body.event === 'RESCHEDULED' && !body.expectedDeliveryAt) { setError('Choose the new delivery date.'); return; }
    pending.current = true;
    try { if (await onSave({ ...body, revision: Number(order.revision || 0) })) setSaved(message); }
    catch (failure) { setError(failure.message || 'Delivery update could not be saved. Please retry.'); }
    finally { pending.current = false; }
  };
  const savedTrackingLink = safeTrackingUrl(order.shipment?.trackingUrl);
  return <section id="manual-delivery" className="admin-card min-w-0 p-5" aria-label="Store-managed delivery">
    <h2 className="flex items-center gap-2"><Truck size={19} />Self delivery / Manual courier</h2>
    <p className="admin-note mt-2">Managed by you, without a courier API account. Customers see saved tracking details and delivery updates in My Orders. No live GPS or automatic courier scans.</p>
    {!editable && <p className="admin-note mt-3">{order.rto?.status === 'IN_TRANSIT' ? 'Return to origin is in progress. Confirm receipt below only after the parcel is back at the store.' : rto ? 'The parcel return is recorded. Follow its inspection and refund status in the RTO controls.' : closed ? 'This delivery is closed. Its history remains available.' : 'Confirm the order before saving delivery details.'}</p>}
    {saved && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{saved}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose">{error}</p>}
    {!editable && order.shipment && <div className="mt-4 space-y-2 text-sm"><p><strong>{order.shipment.deliveryMode === 'SELF' ? 'Self delivery' : order.shipment.courierName || 'Manual courier'}</strong> · {String(order.shipment.status || '').replaceAll('_', ' ')}</p>{(order.shipment.trackingNumber || order.shipment.awb) && <p>Tracking ID: {order.shipment.trackingNumber || order.shipment.awb}</p>}{savedTrackingLink && <a className="admin-table-action-link" href={savedTrackingLink} target="_blank" rel="noopener noreferrer">Track with courier</a>}</div>}
    {editable && <form onSubmit={event => submit(event, { ...form, event: 'DETAILS' }, 'Delivery details saved. The customer can view them in My Orders.')}>
      <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm">Delivery method<select className={field} value={form.deliveryMode} disabled={dispatched} onChange={event => set('deliveryMode', event.target.value)}><option value="COURIER">Manual courier — enter real AWB</option><option value="SELF">Self delivery — I will deliver this order</option></select></label>
        {self ? <p className="admin-note sm:col-span-2">No courier AWB is required. The order ID is the customer's reference. Use the order actions to mark dispatched, out for delivery and delivered.</p> : <>
          <label className="text-sm">Courier name<input className={field} placeholder="Courier name" maxLength={80} required value={form.courierName} onChange={event => set('courierName', event.target.value)} /></label>
          <label className="text-sm">AWB / tracking number<input className={field} placeholder="AWB / tracking number" maxLength={80} required value={form.trackingNumber} onChange={event => set('trackingNumber', event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Courier tracking link (optional)<input className={field} type="url" placeholder="Secure tracking URL (optional)" maxLength={500} value={form.trackingUrl} onChange={event => set('trackingUrl', event.target.value)} /><small className="admin-note">Paste the courier's official HTTPS tracking link. Without a link, the customer can copy the AWB and view your updates here.</small></label>
        </>}
        <label className="text-sm">Expected delivery date (optional)<input className={field} type="date" value={form.expectedDeliveryAt} onChange={event => set('expectedDeliveryAt', event.target.value)} /></label>
        <label className="text-sm">Delivery contact name (optional)<input className={field} maxLength={100} value={form.deliveryContact.name} onChange={event => set('deliveryContact', { ...form.deliveryContact, name: event.target.value })} /></label>
        <label className="text-sm">Customer-visible contact mobile (optional)<input className={field} inputMode="tel" maxLength={15} value={form.deliveryContact.phone} onChange={event => set('deliveryContact', { ...form.deliveryContact, phone: event.target.value })} /><small className="admin-note">Use a business number you agree to share with this customer.</small></label>
        <label className="text-sm sm:col-span-2">Customer-visible delivery note (optional)<textarea className={field} maxLength={300} value={form.note} onChange={event => set('note', event.target.value)} /><small className="admin-note">For private information use Staff notes instead.</small></label>
        <button type="submit" className="admin-btn sm:col-span-2">{busy ? 'Saving…' : 'Save manual shipment'}</button>
      </fieldset>
    </form>}
    {order.shipment && !closed && (editable || order.rto?.status === 'IN_TRANSIT') && <form className="mt-6 border-t pt-4" onSubmit={event => submit(event, { ...update, event: rto ? 'RTO_RECEIVED' : update.event }, 'Delivery update saved and available to the customer in My Orders.')}>
      <h3>Post a delivery update</h3>
      <fieldset disabled={busy} className="mt-3 grid gap-3">
        <label className="text-sm">Update type<select className={field} value={rto ? 'RTO_RECEIVED' : update.event} onChange={event => setUpdate(current => ({ ...current, event: event.target.value }))}>
          {rto ? <option value="RTO_RECEIVED">Parcel received back at store — inspection pending</option> : <><option value="NOTE">Customer update</option>{dispatched && <><option value="ATTEMPT_FAILED">Delivery attempt unsuccessful</option><option value="RESCHEDULED">Schedule another delivery attempt</option><option value="RTO_STARTED">Return undelivered parcel to store</option></>}</>}
        </select></label>
        {update.event === 'RESCHEDULED' && !rto && <label className="text-sm">New delivery date<input className={field} type="date" required value={update.expectedDeliveryAt} onChange={event => setUpdate(current => ({ ...current, expectedDeliveryAt: event.target.value }))} /></label>}
        <label className="text-sm">Update for the customer<textarea className={field} required minLength={3} maxLength={300} value={update.note} onChange={event => setUpdate(current => ({ ...current, note: event.target.value }))} /></label>
        {(rto || update.event === 'RTO_STARTED') && <p className="admin-note">Returning the parcel does not automatically restore stock or refund payment. Complete inspection and refund review separately.</p>}
        <button className="admin-btn-ghost" type="submit" disabled={update.note.trim().length < 3}>Save delivery update</button>
      </fieldset>
    </form>}
    {order.deliveryProof?.receivedBy && <p className="mt-4 text-sm">Received by: <strong>{order.deliveryProof.receivedBy}</strong></p>}
    {order.paymentMethod === 'COD' && <p className="admin-note mt-4">COD collection is separate: after delivery, use Record COD only when payment has actually been collected.</p>}
  </section>;
}
