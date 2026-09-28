import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StartupBoundary from './StartupBoundary';

afterEach(() => jest.restoreAllMocks());

test('normal startup is not delayed or replaced', () => {
  render(<StartupBoundary><p>Store ready</p></StartupBoundary>);
  expect(screen.getByText('Store ready')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a provider render failure leaves a recoverable screen, not an empty root', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenProvider() { throw new Error('Private error detail'); }
  render(<StartupBoundary><BrokenProvider /></StartupBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent("We couldn't open the store");
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  expect(screen.queryByText('Private error detail')).not.toBeInTheDocument();
});
