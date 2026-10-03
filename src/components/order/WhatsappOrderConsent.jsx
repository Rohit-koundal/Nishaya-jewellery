export default function WhatsappOrderConsent({ available, checked, onChange, disabled, phone, storeName }) {
  if (!available) return null;
  const ending = String(phone || '').replace(/\D/g, '').slice(-4);
  return <label className="sc-whatsapp-order-consent">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span><strong>Send my order confirmation on WhatsApp</strong>
      <small>I agree to receive this order’s confirmation from {storeName || 'this store'} on my verified login number{ending ? ` ending ${ending}` : ''}. Optional; no promotional messages. You can still view the order in My Orders.</small>
    </span>
  </label>;
}
