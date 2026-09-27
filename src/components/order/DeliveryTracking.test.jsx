import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeliveryTracking from './DeliveryTracking';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('manual courier displays real tracking link, copy action and store updates', async () => {
  const shipment = { provider: 'manual', courierName: 'Local Courier', trackingNumber: 'REAL-123', trackingUrl: 'https://courier.example/track/REAL-123', status: 'SHIPPED', events: [{ status: 'DELIVERY_UPDATE', note: 'Parcel dispatched today', date: '2026-09-01' }] };
  api.get.mockResolvedValue({ shipment });
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<DeliveryTracking orderId="order-1" initialShipment={shipment} />);
  expect(await screen.findByRole('link', { name: 'Track with courier' })).toHaveAttribute('href', shipment.trackingUrl);
  fireEvent.click(screen.getByRole('button', { name: 'Copy tracking number' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('REAL-123'));
  expect(screen.getByText('Parcel dispatched today')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/orders/order-1/tracking?refresh=1', expect.anything());
});

test('self delivery has contact and updates but no fake AWB or tracking link', async () => {
  api.get.mockResolvedValue({ shipment: { provider: 'manual', deliveryMode: 'SELF', status: 'OUT_FOR_DELIVERY', deliveryContact: { name: 'Store desk', phone: '9000000001' } } });
  render(<DeliveryTracking orderId="order-1" />);
  expect(await screen.findByText(/delivered directly by the store/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Call delivery contact' })).toHaveAttribute('href', 'tel:+919000000001');
  expect(screen.queryByRole('link', { name: 'Track with courier' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Copy tracking number' })).not.toBeInTheDocument();
});

test('failed refresh preserves saved tracking and allows a retry', async () => {
  api.get.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({ shipment: { provider: 'manual', status: 'DELIVERED', trackingNumber: 'REAL-123' } });
  render(<DeliveryTracking orderId="order-1" initialShipment={{ provider: 'manual', trackingNumber: 'REAL-123', status: 'SHIPPED', trackingUrl: 'javascript:alert(1)' }} />);
  expect(await screen.findByRole('status')).toHaveTextContent('Network unavailable');
  expect(screen.getByText('REAL-123')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Track with courier' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh tracking' }));
  expect(await screen.findByText('delivered')).toBeInTheDocument();
});

test('integrated shipments retain their existing carrier-refresh endpoint', async () => {
  const shipment = { provider: 'delhivery', awb: 'INTEGRATED-123', status: 'IN_TRANSIT' };
  api.get.mockResolvedValue({ shipment });
  render(<DeliveryTracking orderId="order-1" initialShipment={shipment} />);
  await screen.findByRole('button', { name: 'Refresh tracking' });
  expect(api.get).toHaveBeenCalledWith('/orders/order-1/delivery?refresh=1', expect.anything());
});

test('late results from an unmounted order cannot update the current order', async () => {
  let resolve; const update = jest.fn();
  api.get.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<DeliveryTracking orderId="old" onUpdate={update} />);
  view.unmount();
  await act(async () => resolve({ shipment: { status: 'DELIVERED' } }));
  expect(update).not.toHaveBeenCalled();
});
