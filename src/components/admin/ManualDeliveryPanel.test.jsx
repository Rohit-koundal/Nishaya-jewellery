import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManualDeliveryPanel from './ManualDeliveryPanel';
import OrderWorkflowActions from './OrderWorkflowActions';

const order = { _id: 'order-1', revision: 4, orderStatus: 'Confirmed', paymentMethod: 'COD' };
test('self delivery saves without a courier AWB and with concurrency context', async () => {
  const save = jest.fn().mockResolvedValue(true);
  render(<ManualDeliveryPanel order={order} onSave={save} />);
  fireEvent.change(screen.getByLabelText('Delivery method'), { target: { value: 'SELF' } });
  expect(screen.queryByPlaceholderText('AWB / tracking number')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save manual shipment' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ deliveryMode: 'SELF', event: 'DETAILS', revision: 4 })));
  expect(await screen.findByRole('status')).toHaveTextContent('Delivery details saved');
});

test('manual courier requires courier name and tracking and retains input on failed save', async () => {
  const save = jest.fn().mockResolvedValue(false);
  render(<ManualDeliveryPanel order={order} onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save manual shipment' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText('Courier name'), { target: { value: 'Local courier' } });
  fireEvent.change(screen.getByPlaceholderText('AWB / tracking number'), { target: { value: 'REAL-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save manual shipment' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(screen.getByPlaceholderText('AWB / tracking number')).toHaveValue('REAL-123');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('dispatched delivery mode cannot change; redelivery requires a new date and public note', async () => {
  const save = jest.fn().mockResolvedValue(true);
  render(<ManualDeliveryPanel order={{ ...order, orderStatus: 'Out for Delivery', shipment: { provider: 'manual', deliveryMode: 'SELF', status: 'EXCEPTION' } }} onSave={save} />);
  expect(screen.getByLabelText('Delivery method')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Update type'), { target: { value: 'RESCHEDULED' } });
  fireEvent.change(screen.getByLabelText('Update for the customer'), { target: { value: 'Next attempt requested by customer.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save delivery update' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('New delivery date'), { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save delivery update' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ event: 'RESCHEDULED', expectedDeliveryAt: '2026-10-01', revision: 4 })));
  expect(await screen.findByRole('status')).toHaveTextContent('Delivery update saved');
});

test('closed orders cannot edit or post manual delivery updates', () => {
  render(<ManualDeliveryPanel order={{ ...order, orderStatus: 'Delivered', shipment: { deliveryMode: 'SELF' }, deliveryProof: { receivedBy: 'Recipient' } }} onSave={jest.fn()} />);
  expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
  expect(screen.getByText('Recipient')).toBeInTheDocument();
});

test('the compact list opens delivery confirmation in details instead of completing without proof', () => {
  const onStatus = jest.fn();
  render(<OrderWorkflowActions compact order={{ ...order, orderStatus: 'Out for Delivery', shipment: { provider: 'manual', deliveryMode: 'SELF' } }} detailHref="/admin/orders/detail?id=order-1" onStatus={onStatus} />);
  expect(screen.getByRole('link', { name: 'Confirm delivery' })).toHaveAttribute('href', '/admin/orders/detail?id=order-1');
  expect(onStatus).not.toHaveBeenCalled();
});
