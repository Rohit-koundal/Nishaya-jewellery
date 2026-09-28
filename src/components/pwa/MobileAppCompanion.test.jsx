import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MobileAppCompanion from './MobileAppCompanion';

const setAppBadge = jest.fn();
const originalLocation = window.location;
const reload = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ itemCount: 3 }) }));
jest.mock('../../context/NotificationContext', () => ({ useNotifications: () => ({ unreadCount: 2 }) }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn((query) => ({ matches: query.includes('max-width'), addEventListener: jest.fn(), removeEventListener: jest.fn() })),
  });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge });
  Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: jest.fn() });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
  });
});

afterEach(() => Object.defineProperty(window, 'location', { configurable: true, value: originalLocation }));

function controllerChanged() {
  const handler = navigator.serviceWorker.addEventListener.mock.calls.find(([name]) => name === 'controllerchange')[1];
  handler();
}

test('first installation and updates from other tabs never reload the current page', () => {
  render(<MobileAppCompanion />);
  controllerChanged();
  expect(reload).not.toHaveBeenCalled();
  fireEvent(window, new CustomEvent('samira:pwa-update', { detail: { registration: { waiting: { postMessage: jest.fn() } } } }));
  controllerChanged();
  expect(reload).not.toHaveBeenCalled();
});

test('an explicitly accepted update reloads exactly once after activation', () => {
  render(<MobileAppCompanion />);
  const postMessage = jest.fn();
  fireEvent(window, new CustomEvent('samira:pwa-update', { detail: { registration: { waiting: { postMessage } } } }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  expect(reload).not.toHaveBeenCalled();
  controllerChanged();
  controllerChanged();
  expect(reload).toHaveBeenCalledTimes(1);
});

test('a removed waiting worker still allows a user-requested refresh', () => {
  render(<MobileAppCompanion />);
  fireEvent(window, new CustomEvent('samira:pwa-update', { detail: { registration: {} } }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('phone companion reports connectivity, offers installation, applies updates and syncs the app badge', async () => {
  render(<MobileAppCompanion />);
  expect(setAppBadge).toHaveBeenCalledWith(5);

  fireEvent(window, new Event('offline'));
  expect(screen.getByText('You are offline')).toBeInTheDocument();

  const prompt = jest.fn().mockResolvedValue(undefined);
  const installEvent = new Event('beforeinstallprompt');
  Object.defineProperties(installEvent, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome: 'accepted' }) },
  });
  fireEvent(window, installEvent);
  fireEvent.click(screen.getByRole('button', { name: 'Install' }));
  await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));

  const postMessage = jest.fn();
  fireEvent(window, new CustomEvent('samira:pwa-update', { detail: { registration: { waiting: { postMessage } } } }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
});
