import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../../services/api';
import OrderNotificationSettings from './OrderNotificationSettings';
import { settingsForm, settingsPayload } from '../../config/storeSettings';

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const ready = { configured: true, missing: [], adminEmail: 'owner@example.com', adminEnabled: true, customerEnabled: true, items: [] };
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue(ready); });

test('shows missing provider configuration and accurately explains available channels', async () => {
  api.get.mockResolvedValue({ ...ready, configured: false, missing: ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL'] });
  render(<OrderNotificationSettings apiBase="/admin/settings" />);
  expect(await screen.findByText('Email: Setup required')).toBeInTheDocument();
  expect(screen.getByText(/BREVO_API_KEY, BREVO_SENDER_EMAIL/)).toBeInTheDocument();
  expect(screen.getByText('WhatsApp: Setup required')).toBeInTheDocument();
  expect(screen.getByText(/This is not a phone push notification/)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/admin/settings/order-notifications', { silent: true });
});

test('accepted is not labelled delivered; uncertain alerts cannot be blindly resent', async () => {
  api.get.mockResolvedValue({ ...ready, items: [
    { _id: '1', order: 'order1', channel: 'EMAIL', audience: 'ADMIN', status: 'ACCEPTED', attempts: 1, updatedAt: '2026-10-01', canRetry: false },
    { _id: '2', order: 'order2', channel: 'EMAIL', audience: 'CUSTOMER', status: 'UNCERTAIN', reason: 'CHECK_PROVIDER_LOGS', attempts: 2, updatedAt: '2026-10-01', canRetry: false },
  ] });
  render(<OrderNotificationSettings apiBase="/admin/settings" />);
  expect(await screen.findByText('Provider accepted')).toBeInTheDocument();
  expect(screen.getByText(/Delivery is uncertain/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Retry.*alert/ })).not.toBeInTheDocument();
});

test('retries only the selected alert using the scoped seller route and prevents double clicks', async () => {
  api.get.mockResolvedValue({ ...ready, items: [{ _id: 'job1', order: 'order1', audience: 'ADMIN', channel: 'EMAIL', status: 'BLOCKED', attempts: 1, updatedAt: '2026-10-01', canRetry: true }] });
  let resolve;
  api.post.mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<OrderNotificationSettings apiBase="/seller/settings" />);
  const button = await screen.findByRole('button', { name: 'Retry admin alert for order order1' });
  fireEvent.click(button); fireEvent.click(button);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/seller/settings/order-notifications/job1/retry', {});
  await act(async () => { resolve({ message: 'Queued safely' }); });
  expect(screen.getByRole('status')).toHaveTextContent('Queued safely');
});

test('fetch errors remain visible with a refresh action', async () => {
  api.get.mockRejectedValueOnce(new Error('Connection unavailable'));
  render(<OrderNotificationSettings apiBase="/admin/settings" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(await screen.findByText(/Saved admin recipient/)).toHaveTextContent('owner@example.com');
});

test('saved settings refresh diagnostics and retain valid switches in the settings payload', async () => {
  const view = render(<OrderNotificationSettings apiBase="/admin/settings" revision="first" />);
  await screen.findByText(/Saved admin recipient/);
  view.rerender(<OrderNotificationSettings apiBase="/admin/settings" revision="saved" />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  const form = settingsForm({ storeName: 'Nishaya Jewellery', orderAdminEmailEnabled: false, orderNotificationEmail: 'orders@example.com' });
  const body = settingsPayload(form);
  expect(body.orderAdminEmailEnabled).toBe(false);
  expect(body.orderCustomerEmailEnabled).toBe(true);
  expect(body.orderNotificationEmail).toBe('orders@example.com');
  expect(body.orderAdminWhatsappEnabled).toBe(false);
  expect(body.orderCustomerWhatsappEnabled).toBe(false);
});

test('WhatsApp readiness and retry do not depend on email credentials; actual delivery is separate', async () => {
  api.get.mockResolvedValue({ ...ready, configured: false, whatsapp: { configured: true, adminConfigured: true, adminEnabled: true }, items: [
    { _id: 'wa1', order: 'order1', channel: 'WHATSAPP', audience: 'ADMIN', status: 'FAILED', providerErrorCode: 131026, attempts: 1, updatedAt: '2026-10-01', canRetry: true },
    { _id: 'wa2', order: 'order2', channel: 'WHATSAPP', audience: 'CUSTOMER', status: 'DELIVERED', attempts: 1, updatedAt: '2026-10-01', canRetry: false },
  ] });
  render(<OrderNotificationSettings apiBase="/admin/settings" />);
  expect(await screen.findByText(/WhatsApp: Credentials configured/)).toBeInTheDocument();
  expect(screen.getByText('Delivered')).toBeInTheDocument();
  expect(screen.getByText('Provider error code: 131026')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry admin alert for order order1' })).toBeEnabled();
});
