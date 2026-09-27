import { categoryDescendants, categoryLabel, categoryMatchesProduct, categoryPath, findCategory, flattenCategories } from './categoryHierarchy';
import { buildCatalogFacets } from './catalogFacets';
import { matchesCatalogFilters, normalizeCatalogQuery } from '../store/catalogSlice';

const categories = [
  { _id: 'r', name: 'Earrings', slug: 'earrings', previousSlugs: ['ear-jewellery'] },
  { _id: 'j', name: 'Jhumkas', slug: 'jhumkas', parent: { _id: 'r' }, level: 1 },
  { _id: 's', name: 'Silver Jhumkas', slug: 'silver-jhumkas', parent: 'j', level: 2 },
  { _id: 'n', name: 'Necklaces', slug: 'necklaces' },
];
test('orders parents before children and disambiguates their full paths', () => {
  expect(flattenCategories([...categories].reverse()).map((item) => item._id)).toEqual(['r', 'j', 's', 'n']);
  expect(categoryLabel('s', categories)).toBe('Earrings / Jhumkas / Silver Jhumkas');
  expect(findCategory('ear-jewellery', categories)._id).toBe('r');
  expect([...categoryDescendants('r', categories)]).toEqual(['r', 'j', 's']);
  expect([...categoryDescendants('', categories)]).toEqual([]);
});
test('handles old strings, populated categories and normalized products', () => {
  expect(categoryMatchesProduct({ category: 'Earrings' }, 'r', categories)).toBe(true);
  expect(categoryMatchesProduct({ category: { _id: 's', name: 'Silver Jhumkas' } }, 'ear-jewellery', categories)).toBe(true);
  expect(categoryMatchesProduct({ categoryId: 's', category: 'Silver Jhumkas' }, 'j', categories)).toBe(true);
  expect(categoryMatchesProduct({ categoryId: 'n' }, 'r', categories)).toBe(false);
});
test('client fallback filters and counts agree on descendant membership without duplicates', () => {
  const products = [{ categoryId: 'r', price: 1000 }, { categoryId: 's', price: 1500 }, { categoryId: 'n', price: 2000 }];
  const filters = normalizeCatalogQuery({ category: 'earrings,jhumkas' });
  expect(products.filter((item) => matchesCatalogFilters(item, filters, categories))).toHaveLength(2);
  const facets = buildCatalogFacets(products, categories, filters);
  expect(facets.categories.find((item) => item.value === 'r').count).toBe(2);
  expect(facets.categories.find((item) => item.value === 's').level).toBe(2);
});
test('malformed legacy cycles do not hang traversal', () => {
  const cyclic = [{ _id: 'a', name: 'A', parent: 'b' }, { _id: 'b', name: 'B', parent: 'a' }];
  expect(categoryPath('a', cyclic)).toHaveLength(2);
  expect(flattenCategories(cyclic)).toHaveLength(2);
});
