export const categoryId = (value) => String(value?._id || value?.id || value || '');
const key = (value) => String(value || '').trim().toLowerCase();

export function categoryPath(value, categories = []) {
  const byId = new Map(categories.map((item) => [categoryId(item), item]));
  const path = [];
  const visited = new Set();
  let current = byId.get(categoryId(value));
  while (current && !visited.has(categoryId(current))) {
    visited.add(categoryId(current));
    path.unshift(current);
    current = byId.get(categoryId(current.parent));
  }
  return path;
}

export function categoryLabel(value, categories = []) {
  return categoryPath(value, categories).map((item) => item.name).join(' / ');
}

export function findCategory(value, categories = []) {
  const selected = key(value);
  return categories.find((item) => [categoryId(item), item.slug, item.name, ...(item.previousSlugs || [])].some((alias) => key(alias) === selected));
}

export function categoryDescendants(value, categories = []) {
  if (!categoryId(value)) return new Set();
  const ids = new Set([categoryId(value)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of categories) {
      if (ids.has(categoryId(item.parent)) && !ids.has(categoryId(item))) { ids.add(categoryId(item)); changed = true; }
    }
  }
  return ids;
}

export function flattenCategories(categories = []) {
  const result = [];
  const visited = new Set();
  const sorted = [...categories].sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0) || String(a.name).localeCompare(String(b.name)));
  const visit = (item, depth) => {
    if (visited.has(categoryId(item))) return;
    visited.add(categoryId(item));
    result.push({ ...item, depth, pathLabel: categoryLabel(item, categories) });
    sorted.filter((child) => categoryId(child.parent) === categoryId(item)).forEach((child) => visit(child, depth + 1));
  };
  sorted.filter((item) => !item.parent).forEach((item) => visit(item, 0));
  // Keep legacy/orphaned records manageable without recursion loops.
  sorted.forEach((item) => visit(item, 0));
  return result;
}

export function categoryMatchesProduct(product, value, categories = []) {
  const selected = findCategory(value, categories);
  const reference = product.categoryId || product.category;
  const assigned = findCategory(categoryId(reference), categories) || (typeof reference === 'object' ? findCategory(reference?.name, categories) : null);
  if (assigned && selected) return categoryPath(assigned, categories).some((item) => categoryId(item) === categoryId(selected));
  const aliases = [categoryId(reference), typeof reference === 'object' ? reference?.name : reference, product.subCategory].map(key);
  return (selected ? [categoryId(selected), selected.slug, selected.name, ...(selected.previousSlugs || [])] : [value]).some((alias) => aliases.includes(key(alias)));
}
