import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ProductCard from './ProductCard';

const fs = require('fs');
const path = require('path');
const mockAdd = jest.fn();
const mockToggle = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ getCartItem: () => null, addToCart: mockAdd, loading: false }) }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ items: [], toggleWishlist: mockToggle, loading: false }) }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: '' }) }));

const product = { id: 'earrings', slug: 'gold-earrings', name: 'Gold earrings', price: 299, stock: 10, colors: ['Gold'], sizes: [], images: [{ url: 'https://images.example.test/earrings-original.png' }] };
let stylesheet;
beforeAll(() => {
  // CRA mocks imported CSS in Jest. Load the real component rules so a future
  // top/cover override is caught, not just the presence of a class name.
  stylesheet = document.createElement('style');
  stylesheet.textContent = [
    fs.readFileSync(path.join(__dirname, '../product/ProductImageCarousel.css'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'ProductCard.css'), 'utf8'),
  ].join('\n');
  document.head.appendChild(stylesheet);
});
afterAll(() => stylesheet.remove());
beforeEach(() => jest.clearAllMocks());

test.each([
  ['portrait', 900, 2400], ['landscape', 2400, 600], ['square', 1600, 1600], ['small', 64, 48],
])('%s photos retain the original source and use proportional centered fitting', (_shape, width, height) => {
  render(<ProductCard product={product} navigate={jest.fn()} />);
  const image = screen.getByRole('img', { name: product.name });
  Object.defineProperties(image, { naturalWidth: { value: width }, naturalHeight: { value: height } });
  fireEvent.load(image);
  const imageStyle = getComputedStyle(image);
  expect(imageStyle.objectFit).toBe('contain');
  expect(imageStyle.objectPosition).toBe('50% 50%');
  expect(imageStyle.position).toBe('absolute');
  expect(imageStyle.width).toBe('100%');
  expect(imageStyle.height).toBe('100%');
  expect(image).toHaveAttribute('src', product.images[0].url);
  expect(image).not.toHaveAttribute('srcset');
  expect(image.style.transform).toBe('');
});

test('the media frame, not image content, owns catalogue dimensions', () => {
  const { container } = render(<ProductCard product={product} navigate={jest.fn()} />);
  const frame = container.querySelector('.sc-product-card__media');
  const carousel = container.querySelector('.sc-product-card__carousel');
  const track = container.querySelector('.sc-product-carousel__track');
  const slide = container.querySelector('.sc-product-carousel__slide');
  const rules = Array.from(stylesheet.sheet.cssRules);
  // jsdom has no layout engine for aspect-ratio/inset; assert the real CSS
  // declarations, without pretending to measure rendered browser geometry.
  const frameRule = rules.find(rule => rule.selectorText?.startsWith('.sc-product-card__media,'));
  const carouselRule = rules.find(rule => rule.selectorText === '.sc-product-card__media > .sc-product-card__carousel');
  expect(getComputedStyle(frame).flexShrink).toBe('0');
  expect(frameRule.style.getPropertyValue('aspect-ratio')).toBe('4 / 5');
  expect(getComputedStyle(carousel).position).toBe('absolute');
  expect(carouselRule.style.getPropertyValue('inset')).toBe('0');
  expect(getComputedStyle(track).position).toBe('absolute');
  expect(getComputedStyle(slide).flexBasis).toBe('100%');
  expect(getComputedStyle(slide).flexShrink).toBe('0');
});

test('mixed-aspect galleries retain the fitting contract on every visited slide', () => {
  const images = ['portrait', 'landscape', 'tiny'].map(name => ({ url: `https://images.example.test/${name}.png` }));
  const { container } = render(<ProductCard product={{ ...product, images }} navigate={jest.fn()} />);
  expect(container.querySelectorAll('img')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
  for (const image of container.querySelectorAll('.sc-product-carousel__image')) {
    expect(getComputedStyle(image).objectFit).toBe('contain');
    expect(getComputedStyle(image).objectPosition).toBe('50% 50%');
  }
  expect(container.querySelector('.sc-product-carousel__track')).toHaveStyle({ transform: 'translateX(-200%)' });
  expect(container.querySelectorAll('img')).toHaveLength(3);
});

test('wishlist, bag and navigation still work without image-layout side effects', async () => {
  const navigate = jest.fn();
  render(<ProductCard product={product} navigate={navigate} imagePriority />);
  expect(screen.getByRole('img')).toHaveAttribute('loading', 'eager');
  expect(screen.getByRole('img')).toHaveAttribute('fetchpriority', 'high');
  fireEvent.click(screen.getByRole('button', { name: 'Add Gold earrings to bag' }));
  expect(mockAdd).toHaveBeenCalledWith(product);
  fireEvent.click(screen.getByRole('button', { name: 'View Gold earrings' }));
  expect(navigate).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' })); });
  expect(mockToggle).toHaveBeenCalledWith(product);
});
