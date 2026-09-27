import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CategoryMenu, { CategoryNavigation } from './CategoryNavigation';
import { useGetCategoriesQuery } from '../../store/apiSlice';
jest.mock('../../store/apiSlice', () => ({ useGetCategoriesQuery: jest.fn() }));
beforeEach(() => useGetCategoriesQuery.mockReturnValue({ data: [{ _id: 'r', name: 'Earrings', slug: 'earrings' }, { _id: 'c', name: 'Jhumkas', slug: 'jhumkas', parent: 'r' }], refetch: jest.fn() }));
test('desktop menu navigates to the managed child and supports Escape', () => {
  const navigate = jest.fn();
  render(<CategoryMenu navigate={navigate} storeSlug="nishaya" route="/" />);
  fireEvent.click(screen.getByRole('button', { name: 'Categories' }));
  fireEvent.click(screen.getByRole('button', { name: 'Jhumkas' }));
  expect(navigate).toHaveBeenCalledWith('/products?category=jhumkas');
  expect(screen.getByRole('button', { name: 'Categories' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Categories' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Jhumkas' }), { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Categories' })).toHaveFocus();
  expect(useGetCategoriesQuery).toHaveBeenCalledWith({ store: 'nishaya' }, expect.any(Object));
});
test('mobile tree provides view-all and subcategory links', () => {
  const navigate = jest.fn();
  render(<CategoryNavigation navigate={navigate} />);
  fireEvent.click(screen.getByText('Earrings'));
  // jsdom does not toggle native details, so simulate the native open state.
  screen.getByText('Earrings').closest('details').open = true;
  fireEvent.click(screen.getByRole('button', { name: 'View all Earrings' }));
  expect(navigate).toHaveBeenCalledWith('/products?category=earrings');
});
test('failed loading has a retry instead of fabricated categories', () => {
  const refetch = jest.fn();
  useGetCategoriesQuery.mockReturnValue({ data: [], error: {}, refetch });
  render(<CategoryNavigation navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(refetch).toHaveBeenCalled();
  expect(screen.queryByText('Sarees')).not.toBeInTheDocument();
});
