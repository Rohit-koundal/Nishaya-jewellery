import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import StorefrontSkeleton from './StorefrontSkeleton';

test('skeleton is inline and shows an honest slow-connection message, not an endless blocking spinner', () => {
  jest.useFakeTimers();
  const { container, unmount } = render(<StorefrontSkeleton />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelector('[data-mobile-loader]')).toBeNull();
  expect(screen.queryByText(/Taking a little longer to load/)).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(5000));
  expect(screen.getByText(/Taking a little longer to load/)).toBeInTheDocument();
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
