import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import QuickViewModal from './QuickViewModal';
const mockAdd = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ addToCart: mockAdd }) }));
test('quick view keeps unavailable items out of the bag while still opening full details', () => {
  const onOpenFull = jest.fn();
  render(<QuickViewModal product={{ _id: 'saree', name: 'Silk saree', stock: 0, price: 1599 }} onClose={jest.fn()} onOpenFull={onOpenFull} />);
  fireEvent.click(screen.getByRole('button', { name: 'Out of stock' }));
  expect(mockAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View full details' }));
  expect(onOpenFull).toHaveBeenCalledTimes(1);
});

test('quick view fits the complete image inside a bounded centered frame', () => {
  const image = 'https://images.example.test/wide-earrings.png';
  render(<QuickViewModal product={{ name: 'Gold earrings', stock: 3, price: 299, images: [{ url: image }] }} onClose={jest.fn()} onOpenFull={jest.fn()} />);
  const photo = screen.getByRole('img', { name: 'Gold earrings' });
  expect(photo).toHaveAttribute('src', image);
  expect(photo).toHaveClass('absolute', 'inset-0', 'object-contain', 'object-center');
  expect(photo).not.toHaveClass('object-cover', 'object-top');
  expect(photo.parentElement).toHaveClass('relative', 'aspect-[4/5]');
});
