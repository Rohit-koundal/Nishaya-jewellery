import { categoryPath } from './categoryHierarchy';

export function getActiveAttributeDefinitions(structure, categories = [], form = {}) {
  const categoryDefinition = findCategoryDefinition(structure, categories, form);
  const merged = new Map((structure?.attributes || []).map((item) => [item.key, item]));
  const chain = [];
  let cursor = categoryDefinition;
  while (cursor && chain.length < 12) {
    chain.unshift(cursor);
    const parentKey = cursor.parentKey;
    cursor = parentKey ? (structure?.categoryDefinitions || []).find((item) => item.key === parentKey) : null;
  }
  chain.forEach((layer) => (layer.attributes || []).forEach((item) => {
    if (typeof item === 'object' && item.key) merged.set(item.key, { ...(merged.get(item.key) || {}), ...item });
  }));
  return Array.from(merged.values()).filter((item) => item.active !== false).sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

export function findCategoryDefinition(structure, categories = [], form = {}) {
  const definitions = structure?.categoryDefinitions || [];
  const selectedCategory = categories.find((category) => String(category._id) === String(form.category?._id || form.category));
  const subcategory = String(form.subCategory || '').trim().toLowerCase();
  if (selectedCategory?.parent) {
    for (const node of categoryPath(selectedCategory, categories).reverse()) {
      const match = definitions.find((item) => item.key === node.definitionKey || item.key === definitionKey(node.name));
      if (match) return match;
    }
  }
  if (subcategory) {
    const child = definitions.find((item) => item.key === definitionKey(subcategory) || String(item.name || '').trim().toLowerCase() === subcategory);
    if (child) return child;
  }
  const lookupKeys = [form.categoryDefinitionKey, selectedCategory?.definitionKey, definitionKey(selectedCategory?.name)].filter(Boolean);
  for (const lookupKey of lookupKeys) {
    const match = definitions.find((item) => item.key === lookupKey);
    if (match) return match;
  }
  return null;
}

export function definitionKey(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

