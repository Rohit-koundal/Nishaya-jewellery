import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import CategoryBrowse from './CategoryBrowse';
const categories = [{ _id: 'r', name: 'Earrings', slug: 'earrings' }, { _id: 'j', name: 'Jhumkas', slug: 'jhumkas', parent: 'r' }, { _id: 's', name: 'Silver Jhumkas', slug: 'silver-jhumkas', parent: 'j' }];
test('category landing drills into children and preserves the store route', () => {
  const navigate = jest.fn();
  render(<CategoryBrowse categories={categories} selected="earrings" storeSlug="nishaya" navigate={navigate} />);
  expect(screen.getByRole('heading', { name: 'Shop Earrings by type' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Jhumkas' }));
  expect(navigate).toHaveBeenCalledWith('/store/nishaya/products?category=jhumkas');
});
test('leaf pages link back to every ancestor without inventing subcategories', () => {
  const navigate = jest.fn();
  render(<CategoryBrowse categories={categories} selected="s" navigate={navigate} />);
  const breadcrumb = screen.getByRole('navigation', { name: 'Category breadcrumb' });
  fireEvent.click(within(breadcrumb).getByRole('button', { name: 'Earrings' }));
  expect(navigate).toHaveBeenCalledWith('/products?category=earrings');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(within(breadcrumb).getByRole('button', { name: 'Silver Jhumkas' })).toHaveAttribute('aria-current', 'page');
});
