import { categoryId, categoryLabel, categoryPath, flattenCategories } from '../../utils/categoryHierarchy';

// The most specific selected node remains Product.category. Existing products,
// drafts and integrations need no migration or second source of truth.
export default function CategoryPicker({ categories = [], value = '', onChange, error, disabled = false, required = false, loading = false }) {
  const available = categories.filter((item) => !item.isArchived);
  const path = categoryPath(value, available);
  const roots = flattenCategories(available).filter((item) => item.depth === 0);
  const levels = [{ options: roots, selected: categoryId(path[0]), parent: '' }];
  path.forEach((node, index) => {
    const children = available.filter((item) => categoryId(item.parent) === categoryId(node))
      .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0) || a.name.localeCompare(b.name));
    if (children.length) levels.push({ options: children, selected: categoryId(path[index + 1]), parent: categoryId(node) });
  });
  const missing = Boolean(value) && !path.length;
  return <div className="grid gap-3">
    {levels.map((level, index) => <label className="admin-field" key={level.parent || 'root'}>
      <span>{index === 0 ? 'Category' : index === 1 ? 'Subcategory' : `Subcategory level ${index}`}{index === 0 && required ? <em>*</em> : null}</span>
      <select data-error-field={index === 0 ? 'category' : undefined} aria-label={index === 0 ? 'Category' : index === 1 ? 'Subcategory' : `Subcategory level ${index}`} className={`admin-field__control${error ? ' is-error' : ''}`} disabled={disabled || loading} value={index === 0 && missing ? categoryId(value) : level.selected} aria-invalid={Boolean(error)} required={index === 0 && required} onChange={(event) => onChange(event.target.value || level.parent)}>
        <option value="">{index === 0 ? loading ? 'Loading categories…' : 'Select category' : `Use ${path[index - 1]?.name || 'parent category'} (no subcategory)`}</option>
        {index === 0 && missing && <option value={categoryId(value)}>Current category unavailable — choose a replacement</option>}
        {level.options.map((item) => <option key={categoryId(item)} value={categoryId(item)}>{item.name}{item.isActive === false ? ' (hidden)' : ''}</option>)}
      </select>
    </label>)}
    {path.length > 1 && <p className="text-xs text-slate-500">Selected: {categoryLabel(value, available)}</p>}
    {error && <p role="alert" className="admin-field__error">{error}</p>}
    {missing && <p className="text-xs text-amber-700">The saved category has not been changed. Choose an available category before publishing.</p>}
  </div>;
}
