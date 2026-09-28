import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductVisual } from './ProductVisual';

test('standalone product visuals preserve the filled frame with a centered crop', () => {
  render(<ProductVisual compact product={{ name: 'Ring', images: [{ url: 'https://images.example.test/ring.png' }] }} />);
  const image = screen.getByRole('img', { name: 'Ring' });
  expect(image).toHaveClass('absolute', 'inset-0', 'object-cover', 'object-center');
  expect(image).not.toHaveClass('object-contain', 'object-top');
  expect(image.parentElement).toHaveClass('relative', 'aspect-[4/5]');
});

test('gallery fallback fills its parent instead of imposing a fixed height', () => {
  const { container } = render(<ProductVisual fill showMeta={false} product={{ name: 'Ring', images: [] }} />);
  expect(container.firstChild).toHaveClass('absolute', 'inset-0', 'h-full', 'w-full');
  expect(container.firstChild).not.toHaveClass('h-56', 'md:h-64');
});

test('a failed product visual still falls back without another image request', () => {
  render(<ProductVisual product={{ name: 'Ring', images: [{ url: 'https://images.example.test/missing.png' }] }} />);
  fireEvent.error(screen.getByRole('img', { name: 'Ring' }));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
